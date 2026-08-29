/**
 * Everything the credential request runs on, on both platforms: the screen registration, the request
 * itself with its `approve` / `respond` / `decline` actions, and the shared container the screen
 * looks the wallet's own credentials up in.
 *
 * ```tsx
 * // dc-api/index.tsx
 * import { registerDcApiScreen } from '@animo-id/expo-digital-credentials-api/request-handler'
 * import { DcApiScreen } from './DcApiScreen'
 *
 * export default registerDcApiScreen(DcApiScreen)
 * ```
 *
 * This entry point is bundled separately from the app: on iOS it runs inside the identity document
 * provider extension (a different process), on Android in the activity the credential picker
 * launches. Keep it off the app's navigation and only import what the request UI needs.
 */
export { getSharedContainerPath } from './api'
export { default, registerDcApiScreen } from './registerScreen'
export type {
  AndroidDcApiRequest,
  DcApiCredential,
  DcApiProtocol,
  DcApiProtocolRequest,
  DcApiRequest,
  DcApiResponseOptions,
  IosDcApiRequest,
  IosDocumentRequest,
  IosDocumentRequestSet,
  IosPresentmentRequest,
  IosReaderAuthentication,
  IosRequestedElement,
  IsoMdocProtocolRequest,
  IsoMdocResponseOptions,
  Openid4vpProtocol,
  Openid4vpProtocolRequest,
  Openid4vpResponseOptions,
} from './types'
export { DcApiUnsupportedError } from './util'
