import { beforeEach, describe, expect, test, vi } from 'vitest'

// `api` imports both react-native and the native module; neither is loadable in this (node) test
// environment, and neither does anything here beyond reporting the platform.
const mockNativeModule = vi.hoisted(() => ({
  registerDocuments: vi.fn(),
  addDocument: vi.fn(),
  registerCredentials: vi.fn(),
  // What the config plugin mirrored out of the app's `…mobile-document-types` entitlement.
  getEntitledDocumentTypes: vi.fn<() => string[] | null>(() => ['org.iso.18013.5.1.mDL']),
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

const photoId: DcApiCredential = {
  id: 'photo-id-1',
  display: { title: 'Photo ID' },
  credential: {
    format: 'mso_mdoc',
    doctype: 'org.iso.23220.photoid.1',
    namespaces: { 'org.iso.23220.1': { family_name_unicode: 'Glastra' } },
  },
}

const sdJwtPid: DcApiCredential = {
  id: 'pid-1',
  display: { title: 'PID' },
  credential: { format: 'dc+sd-jwt', vct: 'eu.europa.ec.eudi.pid.1', claims: { given_name: 'Timo' } },
}

const registeredDocuments = () => mockNativeModule.registerDocuments.mock.calls[0][0]

describe('registerCredentials on ios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNativeModule.getEntitledDocumentTypes.mockReturnValue(['org.iso.18013.5.1.mDL'])
  })

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

  test('skips a document type the app is not entitled to, which the OS would reject', async () => {
    await registerCredentials({ credentials: [mdl, photoId] })

    expect(registeredDocuments()).toEqual([
      {
        documentIdentifier: 'mdl-1',
        documentType: 'org.iso.18013.5.1.mDL',
        supportedAuthorityKeyIdentifiers: [],
      },
    ])
  })

  test("falls back to Apple's full set when the entitlement was not mirrored into the Info.plist", async () => {
    mockNativeModule.getEntitledDocumentTypes.mockReturnValue(null)

    await registerCredentials({ credentials: [mdl, photoId] })

    expect(registeredDocuments().map((registration: { documentType: string }) => registration.documentType)).toEqual([
      'org.iso.18013.5.1.mDL',
      'org.iso.23220.photoid.1',
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
  beforeEach(() => {
    vi.clearAllMocks()
    mockNativeModule.getEntitledDocumentTypes.mockReturnValue(['org.iso.18013.5.1.mDL'])
  })

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

  test('throws for a document type the app is not entitled to, naming what it is entitled to', async () => {
    await expect(registerCredential({ credential: photoId })).rejects.toThrow(
      "Credential 'photo-id-1' cannot be registered on iOS. Only 'mso_mdoc' credentials with one of these document types can: org.iso.18013.5.1.mDL."
    )

    expect(mockNativeModule.addDocument).not.toHaveBeenCalled()
  })
})
