/**
 * The document types Apple allows in the
 * `com.apple.developer.identity-document-services.document-provider.mobile-document-types`
 * entitlement.
 *
 * Mirrors `iosSupportedDocumentTypes` in `src/DigitalCredentialsApi.types.ts`; the plugin is
 * compiled separately from the module, so it cannot import from it.
 */
export const iosSupportedDocumentTypes = [
  'org.iso.18013.5.1.mDL',
  'org.iso.23220.photoid.1',
  'org.iso.23220.1.jp.mnc',
  'eu.europa.ec.eudi.pid.1',
  'eu.europa.ec.av.1',
] as const

export type IosSupportedDocumentType = (typeof iosSupportedDocumentTypes)[number]
