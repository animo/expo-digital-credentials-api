import { type NativeModule, requireOptionalNativeModule } from 'expo'
import { DcApiUnsupportedError } from './util'

/**
 * A document as the iOS module registers it — everything the OS needs to match it, and nothing else.
 * The credential itself never leaves the app.
 */
export type IosDocumentRegistration = {
  documentIdentifier: string
  documentType: string
  supportedAuthorityKeyIdentifiers: string[]

  /**
   * When the OS should stop matching the document, ISO 8601. Absent when it never expires.
   */
  invalidationDate?: string
}

declare class DigitalCredentialsApiModule extends NativeModule {
  isSupported(): boolean
  getRegistrationStatus(): Promise<string>

  /** Android: the encoded credential database plus the matcher that reads it. */
  registerCredentials(credentialsBase64: string, matcher: string): Promise<void>

  /** iOS: registrations with the OS, which does the matching itself. Replaces the whole store. */
  registerDocuments(registrations: IosDocumentRegistration[]): Promise<void>
  addDocument(registration: IosDocumentRegistration): Promise<void>
  removeDocument(documentIdentifier: string): Promise<void>

  /** iOS: path of the app group container, in whichever process asks. */
  getSharedContainerPath(): string

  /** Drops everything this package registered. Both platforms. */
  removeAllCredentials(): Promise<void>

  /**
   * iOS: commit to answering the in-flight request, and get the request the OS then releases as a
   * JSON encoded {@link DcApiProtocolRequest} array. Android needs no equivalent — the picker
   * delivers the requests with the result, so they are on the request from the start.
   */
  approveRequest(): Promise<string>

  /**
   * The response as a JSON encoded `{ protocol, data }` object, in the same shape the requests come
   * in with: `data` is the protocol's own response object, which both platforms take as it is.
   */
  sendResponse(credentialResponse: string): Promise<void>
  sendErrorResponse(errorMessage: string): void
}

// Optional: the module is absent on platforms and simulators where the API does not exist, and the
// public API surfaces that as a typed error rather than a missing-module crash.
const nativeModule = requireOptionalNativeModule<DigitalCredentialsApiModule>('DigitalCredentialsApi')

export function getNativeModule(operation: string) {
  if (!nativeModule) {
    throw new DcApiUnsupportedError(
      `'${operation}' is not available: the digital credentials API native module is not installed. On iOS this requires iOS 26 or higher and the config plugin to be applied.`
    )
  }

  return nativeModule
}

export default nativeModule
