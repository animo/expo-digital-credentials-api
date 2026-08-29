import { beforeEach, describe, expect, test, vi } from 'vitest'

// `api` imports both react-native and the native module; neither is loadable in this (node) test
// environment, and neither does anything here beyond reporting the platform.
const mockNativeModule = vi.hoisted(() => ({
  registerDocuments: vi.fn(),
  addDocument: vi.fn(),
  registerCredentials: vi.fn(),
}))

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('../nativeModule', () => ({
  default: mockNativeModule,
  getNativeModule: () => mockNativeModule,
}))

import { registerCredential, registerCredentials } from '../api'
import type { DcApiCredential } from '../types'

const mdl: DcApiCredential = {
  id: 'mdl-1',
  display: { title: 'Driving licence' },
  credential: {
    format: 'mso_mdoc',
    doctype: 'org.iso.18013.5.1.mDL',
    namespaces: { 'org.iso.18013.5.1': { family_name: 'Glastra' } },
  },
}

const sdJwtPid: DcApiCredential = {
  id: 'pid-1',
  display: { title: 'PID' },
  credential: { format: 'dc+sd-jwt', vct: 'eu.europa.ec.eudi.pid.1', claims: { given_name: 'Timo' } },
}

const registeredDocuments = () => mockNativeModule.registerDocuments.mock.calls[0][0]

describe('registerCredentials on ios', () => {
  beforeEach(() => vi.clearAllMocks())

  test('hands the OS only what it matches on, skipping what it cannot present', async () => {
    await registerCredentials({ credentials: [mdl, sdJwtPid] })

    expect(registeredDocuments()).toEqual([
      {
        documentIdentifier: 'mdl-1',
        documentType: 'org.iso.18013.5.1.mDL',
        supportedAuthorityKeyIdentifiers: [],
      },
    ])
  })

  test("carries each credential's own gates, not one set for the whole call", async () => {
    await registerCredentials({
      credentials: [
        { ...mdl, ios: { supportedAuthorityKeyIdentifiers: ['a2V5'] } },
        { ...mdl, id: 'mdl-2', ios: { invalidationDate: new Date('2027-01-01T00:00:00Z') } },
      ],
    })

    expect(registeredDocuments()).toEqual([
      {
        documentIdentifier: 'mdl-1',
        documentType: 'org.iso.18013.5.1.mDL',
        supportedAuthorityKeyIdentifiers: ['a2V5'],
      },
      {
        documentIdentifier: 'mdl-2',
        documentType: 'org.iso.18013.5.1.mDL',
        supportedAuthorityKeyIdentifiers: [],
        invalidationDate: '2027-01-01T00:00:00.000Z',
      },
    ])
  })

  test('rejects an unusable date instead of registering nothing', async () => {
    await expect(
      registerCredentials({ credentials: [{ ...mdl, ios: { invalidationDate: new Date('not a date') } }] })
    ).rejects.toThrow("'ios.invalidationDate' is not a valid date, for credential 'mdl-1'")

    expect(mockNativeModule.registerDocuments).not.toHaveBeenCalled()
  })
})

describe('registerCredential on ios', () => {
  beforeEach(() => vi.clearAllMocks())

  test('adds one document without replacing the registered set', async () => {
    await registerCredential({ credential: { ...mdl, ios: { supportedAuthorityKeyIdentifiers: ['a2V5'] } } })

    expect(mockNativeModule.addDocument).toHaveBeenCalledWith({
      documentIdentifier: 'mdl-1',
      documentType: 'org.iso.18013.5.1.mDL',
      supportedAuthorityKeyIdentifiers: ['a2V5'],
    })
    expect(mockNativeModule.registerDocuments).not.toHaveBeenCalled()
  })

  test('throws for a credential iOS cannot present, rather than silently registering nothing', async () => {
    await expect(registerCredential({ credential: sdJwtPid })).rejects.toThrow(
      "Credential 'pid-1' cannot be registered on iOS"
    )

    expect(mockNativeModule.addDocument).not.toHaveBeenCalled()
  })
})
