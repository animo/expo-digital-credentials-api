import { Platform } from 'react-native'
import { iosSupportedDocumentTypes } from './iosDocumentTypes'
import { defaultMatcher, encodeCredentialsBase64, matcherProtocols } from './matchers'
import nativeModule, { type IosDocumentRegistration, type IosRegistrationType, getNativeModule } from './nativeModule'
import type {
  DcApiCredential,
  RegisterCredentialOptions,
  RegisterCredentialsOptions,
  RegistrationStatus,
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
 * Whether OpenID4VP requests can be answered and `dc+sd-jwt` credentials registered: on iOS from
 * 27.3, built with its SDK, on Android wherever {@link isSupported}.
 */
export function isOpenId4VpSupported(): boolean {
  if (Platform.OS !== 'ios') return isSupported()

  return nativeModule?.isOpenId4VpSupported?.() ?? false
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
 * whole set on both platforms. On iOS that registers the `mso_mdoc` credentials whose document type
 * is in the config plugin's `ios.documentTypes`, and from iOS 27.3 the `dc+sd-jwt` credentials whose
 * `vct` or one of its `extendedVcts` is in `ios.verifiableCredentialTypes`. The first call on iOS
 * triggers the system permission prompt.
 *
 * Only what the OS matches on leaves the app: the document identifier and type, and the gates in
 * {@link DcApiCredential.ios}. The credentials themselves stay in the wallet's own storage, which is
 * also where the request UI has to look them up again — see {@link getSharedContainerPath}.
 *
 * @returns the ids of the credentials that were actually registered.
 */
export async function registerCredentials(options: RegisterCredentialsOptions): Promise<string[]> {
  const module = getNativeModule('registerCredentials')

  // The picked credential is reported by its id — and on iOS the id is the key the OS stores the
  // registration under — so two credentials sharing one could never be told apart.
  const ids = new Set<string>()
  for (const { id } of options.credentials) {
    if (ids.has(id)) throw new TypeError(`Credential ids must be unique, but '${id}' is used more than once`)
    ids.add(id)
  }

  if (Platform.OS === 'ios') {
    const registrations = options.credentials.flatMap((credential) => toDocumentRegistration(module, credential) ?? [])

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
 * Unlike {@link registerCredentials} a credential this build cannot present throws rather than being
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

  const registration = toDocumentRegistration(module, options.credential)
  if (!registration) {
    throw new DcApiUnsupportedError(
      `Credential '${options.credential.id}' cannot be registered on iOS. Only 'mso_mdoc' credentials with one of these document types can: ${entitledDocumentTypes(module).join(', ')}, and on iOS 27.3 and later 'dc+sd-jwt' credentials of one of these types: ${entitledVerifiableCredentialTypes(module).join(', ') || 'none'}. They are configured with the config plugin's 'ios.documentTypes' and 'ios.verifiableCredentialTypes'.`
    )
  }

  await module.addDocument(registration)
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

/** The registration the OS stores for a credential, or `undefined` when this build cannot register it. */
function toDocumentRegistration(
  module: ReturnType<typeof getNativeModule>,
  credential: DcApiCredential
): IosDocumentRegistration | undefined {
  const { format } = credential.credential
  let type: IosRegistrationType

  if (format === 'mso_mdoc') {
    if (!entitledDocumentTypes(module).includes(credential.credential.doctype)) return undefined
    type = { format, documentType: credential.credential.doctype }
  } else {
    if (!isOpenId4VpSupported()) return undefined

    // A request for a type the credential extends matches it too, as on Android.
    const entitled = entitledVerifiableCredentialTypes(module)
    const verifiableCredentialTypes = [credential.credential.vct, ...(credential.credential.extendedVcts ?? [])].filter(
      (vct) => entitled.includes(vct)
    )
    if (verifiableCredentialTypes.length === 0) return undefined
    type = { format, verifiableCredentialTypes }
  }

  const invalidationDate = encodeInvalidationDate(credential.ios?.invalidationDate, credential.id)

  return {
    documentIdentifier: credential.id,
    ...type,
    supportedIssuerKeyIdentifiers: credential.issuerAuthorityKeyIdentifiers ?? [],
    supportedAuthorityKeyIdentifiers: credential.supportedAuthorityKeyIdentifiers ?? [],
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
 * The document types this build can actually register: the ones its `…mobile-document-types`
 * entitlement lists, which is what the config plugin's `ios.documentTypes` sets — registering
 * anything else is rejected by the OS.
 *
 * Falls back to everything Apple allows when the app was built without the plugin mirroring the
 * entitlement into its Info.plist, or by a version of this package that did not yet mirror it.
 * Nothing here can be read out of the entitlement itself, so that is as close as it gets.
 */
function entitledDocumentTypes(module: { getEntitledDocumentTypes?(): string[] | null }): readonly string[] {
  return module.getEntitledDocumentTypes?.() ?? iosSupportedDocumentTypes
}

/** The same for SD-JWT VC types, without a fallback: Apple publishes no allowed set. */
function entitledVerifiableCredentialTypes(module: {
  getEntitledVerifiableCredentialTypes?(): string[] | null
}): readonly string[] {
  return module.getEntitledVerifiableCredentialTypes?.() ?? []
}
