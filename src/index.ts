export {
  getRegistrationStatus,
  getSharedContainerPath,
  isSupported,
  registerCredential,
  registerCredentials,
  removeAllCredentials,
  removeCredential,
} from './api'
export { iosSupportedDocumentTypes, type IosSupportedDocumentType } from './iosDocumentTypes'
export { defaultMatcher, matcherProtocols } from './matchers'
export type {
  AndroidDcApiRequest,
  AndroidDcApiSelection,
  AndroidRegistrationOptions,
  DcApiClaimValue,
  DcApiCredential,
  DcApiCredentialDisplay,
  DcApiMatcher,
  DcApiMdocCredential,
  DcApiProtocol,
  DcApiProtocolRequest,
  DcApiRequest,
  DcApiResponseOptions,
  DcApiSdJwtCredential,
  IosDcApiRequest,
  IosDocumentRequest,
  IosDocumentRequestSet,
  IosPresentmentRequest,
  IosReaderAuthentication,
  IosRequestedElement,
  IosRegistrationOptions,
  IsoMdocProtocolRequest,
  IsoMdocResponseOptions,
  Openid4vpProtocol,
  Openid4vpProtocolRequest,
  Openid4vpResponseOptions,
  RegisterCredentialOptions,
  RegisterCredentialsOptions,
  RegistrationStatus,
  SdJwtClaims,
} from './types'
export { dcApiProtocols } from './types'
export { DcApiUnsupportedError } from './util'
