import { beforeEach, describe, expect, test, vi } from 'vitest'

// The native module pulls in `expo`, which is not resolvable in this (node) test environment.
const mockNativeModule = vi.hoisted(() => ({
  approveRequest: vi.fn(),
  sendResponse: vi.fn(),
  sendErrorResponse: vi.fn(),
}))

vi.mock('../nativeModule', () => ({
  default: mockNativeModule,
  getNativeModule: () => mockNativeModule,
}))

import { parseRequest } from '../request'
import type { AndroidDcApiRequest, IosPresentmentRequest } from '../types'

const openid4vpRequest = { protocol: 'openid4vp', data: '{"dcql_query":{}}' }
const isoMdocRequest = {
  protocol: 'org-iso-mdoc',
  data: { deviceRequest: 'ZGV2', encryptionInfo: 'ZW5j' },
}

const androidRequest = {
  platform: 'android' as const,
  origin: 'https://digital-credentials.dev',
  callingPackage: 'com.android.chrome',
  matcher: 'multipaz' as const,
  selectedEntryId: '0 org-iso-mdoc mdl-1',
  requests: [openid4vpRequest, isoMdocRequest],
}

const presentmentRequests: IosPresentmentRequest[] = [
  {
    isMandatory: true,
    documentRequestSets: [
      {
        documentRequests: [
          {
            doctype: 'org.iso.18013.5.1.mDL',
            namespaces: {
              'org.iso.18013.5.1': {
                family_name: { intentToRetain: false },
                portrait: { intentToRetain: true },
              },
            },
          },
          { doctype: 'eu.europa.ec.eudi.pid.1', namespaces: {} },
        ],
      },
    ],
  },
]

const iosRequest = {
  platform: 'ios' as const,
  origin: 'https://digital-credentials.dev',
  presentmentRequests,
  readerAuthentications: [{ certificateChain: ['MIIB...'] }],
}

beforeEach(() => {
  mockNativeModule.approveRequest.mockReset()
  mockNativeModule.sendResponse.mockReset()
  mockNativeModule.sendErrorResponse.mockReset()
})

describe('parseRequest, on android', () => {
  test('carries the protocol requests the picker delivered, without approving first', () => {
    const request = parseRequest(JSON.stringify(androidRequest))

    expect(request).toMatchObject({
      platform: 'android',
      origin: 'https://digital-credentials.dev',
      callingPackage: 'com.android.chrome',
      selectedCredentialId: 'mdl-1',
      requests: [openid4vpRequest, isoMdocRequest],
    })
    expect('approve' in request).toBe(false)
  })

  test('resolves the picked entry against the matcher that produced it', () => {
    expect(parseRequest(androidRequest)).toMatchObject({ selectedRequestIndex: 1 })

    expect(
      parseRequest({
        ...androidRequest,
        matcher: 'cmwallet',
        selectedEntryId: JSON.stringify({ provider_idx: 0, id: 'pid-1' }),
      })
    ).toMatchObject({ selectedCredentialId: 'pid-1', selectedRequestIndex: 0 })
  })

  test('drops requests it cannot represent, and keeps the picked index pointing at the same one', () => {
    // The matcher indexes what the verifier sent, so `provider_idx` 2 is the last entry here.
    const request = parseRequest({
      ...androidRequest,
      matcher: 'cmwallet',
      requests: [{ protocol: 'openid4vp-v2-not-a-thing', data: '{}' }, isoMdocRequest, openid4vpRequest],
      selectedEntryId: JSON.stringify({ provider_idx: 2, id: 'pid-1' }),
    })

    expect(request).toMatchObject({
      requests: [isoMdocRequest, openid4vpRequest],
      selectedRequestIndex: 1,
    })
  })

  test('keeps a missing origin absent, rather than blanking it', () => {
    // A native app calling Credential Manager for itself: there is no website, so the OS reports no
    // origin and the caller is only identified by its package.
    const request = parseRequest(JSON.stringify({ ...androidRequest, origin: null }))

    expect(request.origin).toBeUndefined()
    expect(request).toMatchObject({ callingPackage: 'com.android.chrome' })
  })

  test('carries no picked credential when the request never went through the picker', () => {
    // `identitycredentials.action.GET_CREDENTIALS` reaches the wallet without a selected entry.
    const request = parseRequest({ ...androidRequest, selectedEntryId: null }) as AndroidDcApiRequest

    expect(request.selectedCredentialId).toBeUndefined()
    expect(request.selectedRequestIndex).toBe(0)
    expect(request.requests).toHaveLength(2)
  })

  test('falls back to the first request when the matcher answer cannot be mapped', () => {
    const request = parseRequest({
      ...androidRequest,
      matcher: 'cmwallet',
      requests: [openid4vpRequest],
      selectedEntryId: JSON.stringify({ provider_idx: 7, id: 'pid-1' }),
    })

    expect(request).toMatchObject({ selectedRequestIndex: 0 })
  })
})

describe('parseRequest, on ios', () => {
  test('carries the requested documents and elements the OS parsed', () => {
    const request = parseRequest(JSON.stringify(iosRequest))

    expect(request).toMatchObject({
      platform: 'ios',
      presentmentRequests,
      readerAuthentications: [{ certificateChain: ['MIIB...'] }],
    })
  })

  test('carries nothing request-shaped until approved', async () => {
    const request = parseRequest(iosRequest)

    expect('requests' in request).toBe(false)
    expect('selectedCredentialId' in request).toBe(false)

    mockNativeModule.approveRequest.mockResolvedValue(JSON.stringify([isoMdocRequest]))
    expect(request.platform === 'ios' && (await request.approve())).toEqual([isoMdocRequest])
  })
})

describe('responding', () => {
  test('respond sends the protocol and its response object as they are', async () => {
    const request = parseRequest(androidRequest)
    // Only android can answer OpenID4VP, so the union has to be narrowed to say so.
    if (request.platform !== 'android') throw new Error('expected an android request')

    await request.respond({ protocol: 'org-iso-mdoc', data: { response: 'b64url' } })
    expect(mockNativeModule.sendResponse).toHaveBeenCalledWith(
      '{"protocol":"org-iso-mdoc","data":{"response":"b64url"}}'
    )

    await request.respond({ protocol: 'openid4vp', data: { vp_token: {} } })
    expect(mockNativeModule.sendResponse).toHaveBeenCalledWith('{"protocol":"openid4vp","data":{"vp_token":{}}}')
  })

  test('decline always sends a message', () => {
    parseRequest(androidRequest).decline()
    expect(mockNativeModule.sendErrorResponse).toHaveBeenCalledWith('The request was declined')

    parseRequest(androidRequest).decline('no matching credential')
    expect(mockNativeModule.sendErrorResponse).toHaveBeenCalledWith('no matching credential')
  })
})
