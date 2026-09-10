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
  selectedEntryIds: ['0 org-iso-mdoc mdl-1'],
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
      selection: { credentialIds: ['mdl-1'] },
      requests: [openid4vpRequest, isoMdocRequest],
    })
    expect('approve' in request).toBe(false)
  })

  test('resolves the picked entry against the matcher that produced it', () => {
    expect(parseRequest(androidRequest)).toMatchObject({
      selection: { requestIndex: 1, candidateRequestIndexes: [1] },
    })

    expect(
      parseRequest({
        ...androidRequest,
        matcher: 'cmwallet',
        selectedEntryIds: [JSON.stringify({ provider_idx: 0, id: 'pid-1' })],
      })
    ).toMatchObject({ selection: { credentialIds: ['pid-1'], requestIndex: 0 } })
  })

  test('carries every credential of a picked set', () => {
    // A DCQL query for two credentials: the picker returns one per slot of the set.
    const request = parseRequest({
      ...androidRequest,
      selectedEntryIds: ['0 openid4vp pid-1', '0 openid4vp mdl-1'],
    }) as AndroidDcApiRequest

    expect(request.selection).toEqual({
      credentialIds: ['pid-1', 'mdl-1'],
      requestIndex: 0,
      candidateRequestIndexes: [0],
    })
  })

  test('leaves the request open when several share the matched protocol', () => {
    const request = parseRequest({
      ...androidRequest,
      requests: [openid4vpRequest, isoMdocRequest, openid4vpRequest],
      selectedEntryIds: ['0 openid4vp pid-1'],
    }) as AndroidDcApiRequest

    expect(request.selection).toMatchObject({ requestIndex: undefined, candidateRequestIndexes: [0, 2] })
  })

  test('drops requests it cannot represent, and keeps the picked index pointing at the same one', () => {
    // The matcher indexes what the verifier sent, so `provider_idx` 2 is the last entry here.
    const request = parseRequest({
      ...androidRequest,
      matcher: 'cmwallet',
      requests: [{ protocol: 'openid4vp-v2-not-a-thing', data: '{}' }, isoMdocRequest, openid4vpRequest],
      selectedEntryIds: [JSON.stringify({ provider_idx: 2, id: 'pid-1' })],
    })

    expect(request).toMatchObject({
      requests: [isoMdocRequest, openid4vpRequest],
      selection: { requestIndex: 1 },
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
    const request = parseRequest({ ...androidRequest, selectedEntryIds: null }) as AndroidDcApiRequest

    expect(request.selection).toBeUndefined()
    expect(request.requests).toHaveLength(2)
  })

  test('names no request when the matcher answer cannot be mapped', () => {
    const request = parseRequest({
      ...androidRequest,
      matcher: 'cmwallet',
      requests: [openid4vpRequest],
      selectedEntryIds: [JSON.stringify({ provider_idx: 7, id: 'pid-1' })],
    })

    expect(request).toMatchObject({
      selection: { credentialIds: ['pid-1'], requestIndex: undefined, candidateRequestIndexes: [] },
    })
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
    expect('selection' in request).toBe(false)

    mockNativeModule.approveRequest.mockResolvedValue(JSON.stringify([isoMdocRequest]))
    expect(request.platform === 'ios' && (await request.approve())).toEqual([isoMdocRequest])
  })
})

describe('responding', () => {
  test('respond sends the protocol and its response object as they are', async () => {
    await parseRequest(androidRequest).respond({ protocol: 'org-iso-mdoc', data: { response: 'b64url' } })
    expect(mockNativeModule.sendResponse).toHaveBeenCalledWith(
      '{"protocol":"org-iso-mdoc","data":{"response":"b64url"}}'
    )

    const request = parseRequest(androidRequest)
    // Only android can answer OpenID4VP, so the union has to be narrowed to say so.
    if (request.platform !== 'android') throw new Error('expected an android request')

    await request.respond({ protocol: 'openid4vp', data: { vp_token: {} } })
    expect(mockNativeModule.sendResponse).toHaveBeenCalledWith('{"protocol":"openid4vp","data":{"vp_token":{}}}')
  })

  test('decline always sends a message', () => {
    parseRequest(androidRequest).decline()
    expect(mockNativeModule.sendErrorResponse).toHaveBeenCalledWith('The request was declined')

    parseRequest(androidRequest).decline('no matching credential')
    expect(mockNativeModule.sendErrorResponse).toHaveBeenCalledWith('no matching credential')
  })

  test('answers a request once', async () => {
    const request = parseRequest(androidRequest)

    await request.respond({ protocol: 'org-iso-mdoc', data: { response: 'b64url' } })
    await expect(request.respond({ protocol: 'org-iso-mdoc', data: { response: 'b64url' } })).rejects.toThrow(
      'already answered'
    )
    request.decline()

    expect(mockNativeModule.sendResponse).toHaveBeenCalledTimes(1)
    expect(mockNativeModule.sendErrorResponse).not.toHaveBeenCalled()
  })

  test('can still decline after a response the platform refused', async () => {
    const request = parseRequest(androidRequest)
    mockNativeModule.sendResponse.mockRejectedValueOnce(new Error('The credential response must be a JSON object'))

    await expect(request.respond({ protocol: 'org-iso-mdoc', data: { response: 'b64url' } })).rejects.toThrow()
    request.decline()

    expect(mockNativeModule.sendErrorResponse).toHaveBeenCalledWith('The request was declined')
  })
})
