/**
 * The document types Apple allows in the
 * `com.apple.developer.identity-document-services.document-provider.mobile-document-types`
 * entitlement.
 *
 * An app is entitled to the ones it lists there — the config plugin's `ios.documentTypes` — and
 * registering a document type outside that list is rejected by the OS, so
 * {@link registerCredentials} skips those credentials rather than sending them. This is the outer
 * bound of what can be configured, not what any one build registers.
 *
 * Shared with the config plugin, which compiles this file too and validates `ios.documentTypes`
 * against it — so it must not import anything.
 */
export const iosSupportedDocumentTypes = [
  'org.iso.18013.5.1.mDL',
  'org.iso.23220.photoid.1',
  'org.iso.23220.1.jp.mnc',
  'eu.europa.ec.eudi.pid.1',
  'eu.europa.ec.av.1',
] as const
export type IosSupportedDocumentType = (typeof iosSupportedDocumentTypes)[number]
