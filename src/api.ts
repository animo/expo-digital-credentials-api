import { Platform } from 'react-native'
import { defaultMatcher, encodeCredentialsBase64, matcherProtocols } from './matchers'
import nativeModule, { type IosDocumentRegistration, getNativeModule } from './nativeModule'
import {
  type DcApiCredential,
  type DcApiMdocCredential,
  type RegisterCredentialOptions,
  type RegisterCredentialsOptions,
  type RegistrationStatus,
  iosSupportedDocumentTypes,
} from './types'
import { DcApiUnsupportedError } from './util'

/**
 * Whether the Digital Credentials API can be used on this device. On iOS this requires iOS 26 or
 * higher; on Android it requires Credential Manager with the registry API.
 */
export function isSupported(): boolean {
  return nativeModule?.isSupported() ?? false
}

/**
 * Whether the user has allowed this app to provide identity documents.
 *
 * On iOS the first {@link registerCredentials} call triggers the system permission prompt; this
 * reports the current state without prompting. Android needs no permission, so it is `authorized`
 * whenever the API is available.
 */
export async function getRegistrationStatus(): Promise<RegistrationStatus> {
  if (!nativeModule) return 'notSupported'

  return (await nativeModule.getRegistrationStatus()) as RegistrationStatus
}

/**
 * Register the credentials that should surface in the system credential picker, replacing any
 * previously registered set.
 *
 * Credentials the platform cannot present are skipped rather than rejected, so a wallet can pass its
 * whole set on both platforms. On iOS that means everything except `mso_mdoc` credentials whose
 * document type is in {@link iosSupportedDocumentTypes} — the OS does the matching there, and only
 * knows those. The first call on iOS triggers the system permission prompt.
 *
 * Only what the OS matches on leaves the app: the document identifier and type, and the gates in
 * {@link DcApiCredential.ios}. The credentials themselves stay in the wallet's own storage, which is
 * also where the request UI has to look them up again — see {@link getSharedContainerPath}.
 *
 * @returns the ids of the credentials that were actually registered.
 */
export async function registerCredentials(options: RegisterCredentialsOptions): Promise<string[]> {
  const module = getNativeModule('registerCredentials')

  if (Platform.OS === 'ios') {
    const registrations = options.credentials.filter(isRegistrableOnIos).map(toDocumentRegistration)

    await module.registerDocuments(registrations)
    return registrations.map((registration) => registration.documentIdentifier)
  }

  const matcher = options.android?.matcher ?? defaultMatcher
  const protocols = options.android?.protocols ?? matcherProtocols[matcher]

  await module.registerCredentials(
    encodeCredentialsBase64(matcher, options.credentials, { protocols, debug: options.android?.debug }),
    matcher
  )

  return options.credentials.map((credential) => credential.id)
}

/**
 * Register one credential, leaving everything else that is registered alone.
 *
 * iOS only, where the OS keeps the registered set itself and each document is added and removed on
 * its own. On Android the whole credential registry is replaced at once, so a wallet adding a single
 * credential calls {@link registerCredentials} with its full set.
 *
 * Unlike {@link registerCredentials} a credential iOS cannot present throws rather than being
 * skipped: the caller named this one credential, and silently registering nothing would look exactly
 * like success.
 */
export async function registerCredential(options: RegisterCredentialOptions): Promise<void> {
  const module = getNativeModule('registerCredential')

  if (Platform.OS !== 'ios') {
    throw new DcApiUnsupportedError(
      "'registerCredential' is only supported on iOS. On Android, call registerCredentials with the full set of credentials."
    )
  }

  if (!isRegistrableOnIos(options.credential)) {
    throw new DcApiUnsupportedError(
      `Credential '${options.credential.id}' cannot be registered on iOS. Only 'mso_mdoc' credentials with one of these document types can: ${iosSupportedDocumentTypes.join(', ')}.`
    )
  }

  await module.addDocument(toDocumentRegistration(options.credential))
}

/**
 * Remove a single registered credential. iOS only — on Android call {@link registerCredentials} with
 * the remaining credentials, since the whole registry is replaced at once.
 */
export async function removeCredential(credentialId: string): Promise<void> {
  const module = getNativeModule('removeCredential')

  if (Platform.OS !== 'ios') {
    throw new DcApiUnsupportedError(
      "'removeCredential' is only supported on iOS. On Android, call registerCredentials with the remaining credentials."
    )
  }

  await module.removeDocument(credentialId)
}

/**
 * Remove all registered credentials, on both platforms.
 */
export async function removeAllCredentials(): Promise<void> {
  await getNativeModule('removeAllCredentials').removeAllCredentials()
}

/**
 * Absolute path of the app group container the app and the credential request UI share.
 *
 * iOS only, and the same path in both processes: the request UI runs inside the provider extension,
 * which has its own sandbox and cannot see the app's own container. A wallet that has to look up
 * credentials while answering a request — which is every wallet, since iOS has no system picker —
 * keeps its database here.
 *
 * Nothing of this package's lives in the container; it only resolves the path. The app group comes
 * from the config plugin's `ios.appGroup`, and this throws when none is configured.
 *
 * On Android there is nothing to share: the request UI runs in the app's own sandbox.
 */
export function getSharedContainerPath(): string {
  if (Platform.OS !== 'ios') {
    throw new DcApiUnsupportedError(
      "'getSharedContainerPath' is only supported on iOS. On Android the request UI runs in the app's own sandbox, so its normal storage is already shared."
    )
  }

  return getNativeModule('getSharedContainerPath').getSharedContainerPath()
}

/**
 * The OS stores both gates with each document, so they come from the credential itself.
 */
function toDocumentRegistration(
  credential: DcApiCredential & { credential: DcApiMdocCredential }
): IosDocumentRegistration {
  const invalidationDate = encodeInvalidationDate(credential.ios?.invalidationDate, credential.id)

  return {
    documentIdentifier: credential.id,
    documentType: credential.credential.doctype,
    supportedAuthorityKeyIdentifiers: credential.ios?.supportedAuthorityKeyIdentifiers ?? [],
    ...(invalidationDate ? { invalidationDate } : {}),
  }
}

/**
 * The bridge takes the invalidation date as an ISO 8601 string, so an unusable `Date` fails here —
 * naming the credential it came from — rather than as a conversion error from native.
 */
function encodeInvalidationDate(invalidationDate: Date | undefined, credentialId: string): string | undefined {
  if (invalidationDate === undefined) return undefined

  if (Number.isNaN(invalidationDate.getTime())) {
    throw new TypeError(`'ios.invalidationDate' is not a valid date, for credential '${credentialId}'`)
  }

  return invalidationDate.toISOString()
}

/**
 * The OS matches on document type, so only mdocs with a type Apple allows in the
 * `…mobile-document-types` entitlement can be registered at all.
 */
function isRegistrableOnIos(
  credential: DcApiCredential
): credential is DcApiCredential & { credential: DcApiMdocCredential } {
  return (
    credential.credential.format === 'mso_mdoc' &&
    (iosSupportedDocumentTypes as readonly string[]).includes(credential.credential.doctype)
  )
}
