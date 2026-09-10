/**
 * Protocols the Digital Credentials API can carry.
 *
 * The `openid4vp-v1-*` variants are what Chrome sends for OpenID4VP 1.0; `openid4vp` is the earlier
 * draft identifier. `org-iso-mdoc` is ISO/IEC TS 18013-7:2025 Annex C, the only protocol iOS speaks.
 */
export const dcApiProtocols = [
  'openid4vp',
  'openid4vp-v1-unsigned',
  'openid4vp-v1-signed',
  'openid4vp-v1-multisigned',
  'org-iso-mdoc',
] as const
export type DcApiProtocol = (typeof dcApiProtocols)[number]

export type Openid4vpProtocol = Exclude<DcApiProtocol, 'org-iso-mdoc'>

export interface Openid4vpProtocolRequest {
  protocol: Openid4vpProtocol

  /**
   * The OpenID4VP authorization request as a JSON string.
   */
  data: string
}

export interface IsoMdocProtocolRequest {
  protocol: 'org-iso-mdoc'

  /**
   * ISO/IEC TS 18013-7:2025 C.2 request. Both members are base64url-no-pad encoded CBOR.
   */
  data: {
    deviceRequest: string
    encryptionInfo: string
  }
}

export type DcApiProtocolRequest = Openid4vpProtocolRequest | IsoMdocProtocolRequest

export interface IsoMdocResponseOptions {
  protocol: 'org-iso-mdoc'

  /**
   * The ISO/IEC TS 18013-7:2025 C.3 response object, whose single member is the base64url-no-pad
   * encoded `EncryptedResponse`.
   */
  data: {
    response: string
  }
}

export interface Openid4vpResponseOptions {
  protocol: Openid4vpProtocol

  /**
   * The OpenID4VP authorization response object, exactly as it should reach the verifier — nothing
   * is added to it.
   */
  data: Record<string, unknown>
}

export type DcApiResponseOptions = IsoMdocResponseOptions | Openid4vpResponseOptions

/**
 * How the request UI finishes a request. Identical on both platforms.
 */
interface DcApiRequestActions<Response extends DcApiResponseOptions = DcApiResponseOptions> {
  /**
   * Complete the request with the protocol response the wallet built.
   *
   * This mirrors what the Digital Credentials API itself carries: the protocol — always stated,
   * never inferred, and it must be the one that was answered — and that protocol's response object,
   * which reaches the verifier as it is.
   *
   * A request is answered once: this rejects after the request was answered or declined. A response
   * the platform refused does not count, so it can be retried, or the request declined.
   */
  respond(options: Response): Promise<void>

  /**
   * Decline the request. The reason is for logs only — the OS decides what the verifier sees.
   *
   * Does nothing once the request was answered or declined.
   */
  decline(reason?: string): void
}

export interface AndroidDcApiRequest extends DcApiRequestActions {
  platform: 'android'

  /**
   * WHATWG ASCII serialization of the requesting website origin, e.g.
   * `https://digital-credentials.dev`, as the OS reported it — never take the origin from the
   * request payload.
   *
   * `undefined` when the request did not come from a website: a native app calling Credential
   * Manager for itself has no origin, and is identified by {@link callingPackage} instead. Handle
   * that case explicitly — decline, or derive the app-based origin the protocol prescribes from the
   * calling package and its signature. Binding a response to an empty or guessed origin binds it to
   * the wrong verifier.
   *
   * A request whose origin cannot be verified never gets here: if the caller claims an origin but is
   * not a privileged app, the request fails natively rather than arriving without one.
   */
  origin: string | undefined

  /**
   * The package that made the request, e.g. `com.android.chrome`.
   */
  callingPackage: string

  /**
   * The protocol requests the verifier sent, in the order it sent them.
   *
   * Android hands the request over with the picker result, so this is available immediately — there
   * is nothing to commit to first. Requests carrying a protocol this package does not know are left
   * out, which is why this can be empty.
   */
  requests: DcApiProtocolRequest[]

  /**
   * What the user picked in the system credential picker.
   *
   * Absent when the request never went through the picker — a caller can reach the wallet through
   * `identitycredentials.action.GET_CREDENTIALS`, where nothing was selected. The wallet then picks
   * the credentials itself, from {@link requests}, the way it has to on iOS.
   */
  selection?: AndroidDcApiSelection
}

/**
 * The credentials the user picked in the Android credential picker, and the request they answer.
 *
 * The picker returns whatever the wasm matcher wrote into the entries, so this is only as precise as
 * the matcher.
 */
export interface AndroidDcApiSelection {
  /**
   * The picked credentials, as passed to {@link RegisterCredentialsOptions.credentials}.
   *
   * More than one when the request asks for several credentials together, e.g. a DCQL query with
   * two `credentials`, or `credential_sets` whose chosen option has several members, or an Annex C
   * `deviceRequest` with several `docRequests`. The picker then shows them as one set and returns
   * one credential per slot. Only the `multipaz` matcher builds sets; the others always return one.
   *
   * This is the order the picker returns them in, which is not necessarily the order of the query.
   * Match each credential against the request to find the query it answers.
   */
  credentialIds: string[]

  /**
   * Index into {@link AndroidDcApiRequest.requests}: the request the credentials were matched
   * against.
   *
   * `undefined` when the matcher's answer does not identify a single request, see
   * {@link candidateRequestIndexes}.
   */
  requestIndex: number | undefined

  /**
   * Every request in {@link AndroidDcApiRequest.requests} the credentials may have been matched
   * against, in order. {@link requestIndex} is set exactly when this has one entry.
   *
   * The `multipaz` matcher only reports the protocol it answered, so every request with that
   * protocol is a candidate. The matcher answers the first request the registered credentials can
   * satisfy, so of the candidates it is the first one the picked credentials satisfy: evaluate them
   * in order. The `cmwallet` and `ubique` matchers report the request itself.
   *
   * Empty when the matched request uses a protocol this package does not know, and so was left out
   * of the requests.
   */
  candidateRequestIndexes: number[]
}

/**
 * An element the verifier asked for, as parsed by iOS.
 */
export interface IosRequestedElement {
  /**
   * The verifier's `intentToRetain` for this element (ISO/IEC 18013-5 `ItemsRequest`): whether it
   * intends to store the value rather than only check it. A claim, not a guarantee — the OS reports
   * it, nothing enforces it.
   */
  intentToRetain: boolean
}

export interface IosDocumentRequest {
  /**
   * The mdoc document type asked for, e.g. `org.iso.18013.5.1.mDL`.
   */
  doctype: string

  /**
   * The requested elements, keyed by namespace and then by element identifier.
   *
   * ```ts
   * { 'org.iso.18013.5.1': { family_name: { intentToRetain: false } } }
   * ```
   */
  namespaces: Record<string, Record<string, IosRequestedElement>>
}

export interface IosDocumentRequestSet {
  /**
   * `ISO18013MobileDocumentRequest.DocumentRequestSet.requests`, passed through unchanged.
   */
  documentRequests: IosDocumentRequest[]
}

export interface IosPresentmentRequest {
  /**
   * `ISO18013MobileDocumentRequest.PresentmentRequest.isMandatory`, as the OS reported it.
   */
  isMandatory: boolean

  documentRequestSets: IosDocumentRequestSet[]
}

/**
 * Reader authentication (ISO/IEC 18013-5) as the OS parsed it out of the request.
 */
export interface IosReaderAuthentication {
  /**
   * The reader's certificate chain, each certificate base64 encoded DER, in the order the OS
   * returned it.
   *
   * Whether an unsigned request reaches the wallet at all is decided at registration time by
   * {@link RegisterCredentialsOptions.ios.supportedAuthorityKeyIdentifiers}.
   */
  certificateChain: string[]
}

export interface IosDcApiRequest extends DcApiRequestActions<IsoMdocResponseOptions> {
  platform: 'ios'

  /**
   * WHATWG ASCII serialization of the requesting website origin. See
   * {@link AndroidDcApiRequest.origin}.
   *
   * Always present, unlike on Android: iOS binds the origin into both the raw request validation and
   * the session transcript, so a request the OS reports no origin for cannot be answered at all and
   * is cancelled before the request UI is shown.
   */
  origin: string

  /**
   * The request as the OS parsed it, before the raw request is released by {@link approve}.
   *
   * This mirrors `ISO18013MobileDocumentRequest.presentmentRequests` one to one, and is everything
   * the wallet has to render consent from: iOS has no system picker, so the wallet matches this
   * against its own credential storage and picks the answering credential itself.
   */
  presentmentRequests: IosPresentmentRequest[]

  /**
   * The reader authentications the request carried. Empty when the request was not signed.
   */
  readerAuthentications: IosReaderAuthentication[]

  /**
   * Commit to answering the request, and get the protocol request to answer.
   *
   * iOS only: the OS holds the raw request back until the wallet commits, so this must be called
   * after the user approved. On Android the requests are on the request itself from the start.
   *
   * Always resolves with exactly one `org-iso-mdoc` request — the only protocol iOS speaks — in the
   * same shape {@link AndroidDcApiRequest.requests} has.
   */
  approve(): Promise<IsoMdocProtocolRequest[]>
}

/**
 * An incoming credential request, as passed to the component registered with `registerDcApiScreen`.
 *
 * A union discriminated on `platform`, because the platforms genuinely know different things before
 * the user approves: Android delivers the request with the picker result, iOS a parsed summary of it
 * and nothing more until {@link IosDcApiRequest.approve} is called.
 */
export type DcApiRequest = AndroidDcApiRequest | IosDcApiRequest

/**
 * The wasm matcher Credential Manager runs to match registered credentials against a request.
 *
 * - `multipaz` (default) — from [multipaz](https://github.com/openwallet-foundation/multipaz), the
 *   only matcher supporting `org-iso-mdoc`. Supports icons and claim values.
 * - `cmwallet` — from [CMWallet](https://github.com/digitalcredentialsdev/CMWallet). No icons.
 * - `ubique` — from [oid4vp-wasm-matcher](https://github.com/UbiqueInnovation/oid4vp-wasm-matcher).
 *
 * `cmwallet` and `ubique` only match OpenID4VP requests.
 */
export type DcApiMatcher = 'multipaz' | 'cmwallet' | 'ubique'

/**
 * How the OS should treat one document. iOS only: Android's matcher has gates of its own, see
 * {@link AndroidRegistrationOptions}.
 *
 * Set on {@link DcApiCredential.ios}, since Apple stores both with each document
 * ({@link https://developer.apple.com/documentation/identitydocumentservices/mobiledocumentregistration | `MobileDocumentRegistration`}).
 */
export interface IosRegistrationOptions {
  /**
   * Reader-auth trust gating, applied by the OS while matching — before the wallet is involved at
   * all. Each entry is the base64 encoding of one X.509 authority key identifier — Apple takes
   * these as `Data` (`MobileDocumentRegistration.supportedAuthorityKeyIdentifiers`) — belonging to
   * an authority the wallet trusts to sign requests.
   *
   * - **Empty (the default).** Every request matches, signed or not. The wallet decides what to
   *   do with {@link IosDcApiRequest.readerAuthentications} itself, including doing nothing.
   * - **Non-empty.** Only requests whose reader authentication chains up to one of these
   *   authorities match. Everything else — including unsigned requests — never reaches the
   *   wallet, and the user sees no entry for it.
   *
   * On Android, {@link AndroidRegistrationOptions.supportedAuthorityKeyIdentifiers} does the same
   * with the `multipaz` matcher.
   */
  supportedAuthorityKeyIdentifiers?: string[]

  /**
   * When the registration stops being valid (`MobileDocumentRegistration.invalidationDate`). Past
   * it the OS no longer matches the document, so the wallet is not offered for it — without the
   * wallet having to run to unregister it.
   *
   * Leave it out (the default) to register without an expiry.
   *
   * A date that has already passed is rejected: it would register something the OS can never
   * match, which is indistinguishable from the credential not being registered at all.
   *
   * Android has no equivalent — re-register with {@link registerCredentials} when the set changes.
   */
  invalidationDate?: Date
}

export interface RegisterCredentialsOptions {
  /**
   * The credentials to surface in the system credential picker. Replaces any previously registered
   * set, so pass the full set every time it changes.
   */
  credentials: DcApiCredential[]

  android?: {
    /**
     * @default 'multipaz'
     */
    matcher?: DcApiMatcher

    /**
     * The protocols the credentials can be presented over. Only the `multipaz` matcher can answer
     * anything other than OpenID4VP.
     *
     * @default all protocols supported by the matcher
     */
    protocols?: DcApiProtocol[]

    /**
     * Enable the matcher's debug mode. Only the `ubique` matcher supports this.
     */
    debug?: boolean
  }
}

/**
 * Registering a single credential, without touching the rest of the registered set. iOS only —
 * see {@link registerCredential}.
 */
export interface RegisterCredentialOptions {
  credential: DcApiCredential
}

/**
 * How the credential is drawn in the system credential picker.
 *
 * Android only. iOS has no system picker. What the user sees on iOS is the
 * wallet's own request UI, drawn from {@link IosDcApiRequest.presentmentRequests}
 * and the wallet's own storage.
 */
export interface DcApiCredentialDisplay {
  title: string
  subtitle?: string

  /**
   * Data url of the credential's icon.
   */
  iconDataUrl?: `data:image/${'jpg' | 'png'};base64,${string}`

  /**
   * Display metadata per claim, keyed by the claim's path.
   */
  claims?: Array<{
    // TODO: path can contain null for array selectors
    path: string[]

    displayName?: string

    /**
     * What the picker shows as the claim's value, instead of the value itself.
     *
     * Only with the `multipaz` matcher: it is the one matcher that keeps the displayed value apart
     * from the value it matches on. The others compare the value they show, so overriding it there
     * would decide whether the credential matches.
     *
     * Nothing is formatted for you: without this the picker shows the value you registered, and
     * nothing at all for a claim registered without one. Pass `''` to leave a claim's value out of
     * the picker while keeping the value it matches on.
     */
    displayValue?: string
  }>
}

/**
 * A claim value, in the shapes a matcher registry holds.
 *
 * Registered as it is: nothing here is formatted, and nothing is decoded for you. A credential
 * carrying a date or a portrait passes whatever string it wants matched, or `null` to register the
 * claim without a value at all. What the claim should read as in the picker is the wallet's
 * decision, and {@link DcApiCredentialDisplay} `displayValue` is where it makes it.
 */
export type DcApiClaimValue = string | number | boolean | null

export interface DcApiMdocCredential {
  format: 'mso_mdoc'
  doctype: string

  /**
   * The namespaces of the credential.
   *
   * Android only, where they become the claim database the matcher queries. iOS registers
   * {@link doctype} alone and matches on that, so a verifier asking for an element surfaces every
   * registered document of that type, including one that does not carry it — see
   * {@link IosDcApiRequest.presentmentRequests}.
   */
  namespaces: Record<string, Record<string, DcApiClaimValue>>
}

export type SdJwtClaims = {
  [key: string]: DcApiClaimValue | SdJwtClaims | Array<DcApiClaimValue | SdJwtClaims>
}

/**
 * Android only: iOS registers `mso_mdoc` documents alone, and {@link registerCredentials} skips
 * these there rather than rejecting them.
 */
export interface DcApiSdJwtCredential {
  format: 'dc+sd-jwt'
  vct: string

  /**
   * The decoded claims of the SD-JWT DC, including the resolved disclosures.
   */
  claims: SdJwtClaims
}

export interface DcApiCredential {
  id: string

  /**
   * How the credential is drawn in the system credential picker. Android only, and ignored on iOS —
   * see {@link DcApiCredentialDisplay}. Still required everywhere, so one credential set can be
   * passed to {@link registerCredentials} on both platforms.
   */
  display: DcApiCredentialDisplay

  credential: DcApiMdocCredential | DcApiSdJwtCredential

  /**
   * Gates the OS applies to this credential while matching. iOS only, and ignored on Android.
   */
  ios?: IosRegistrationOptions

  /**
   * Gates the matcher applies to this credential while matching. Android only, and ignored on iOS.
   */
  android?: AndroidRegistrationOptions
}

/**
 * How the Android matcher should treat one credential. Only the `multipaz` matcher reads these.
 *
 * Both take the base64 encoding of X.509 authority key identifiers, as
 * {@link IosRegistrationOptions.supportedAuthorityKeyIdentifiers} does. The matcher only compares
 * identifiers: it verifies no signature and no chain, so what it lets through still has to be
 * checked in the request UI.
 */
export interface AndroidRegistrationOptions {
  /**
   * The authority key identifier of every certificate in the credential's issuer chain: the MSO's
   * `x5chain` for an mdoc, the `x5c` header for an SD-JWT VC.
   *
   * A verifier can name the issuers it accepts, as `trusted_authorities` of type `aki` in a DCQL
   * credential query or as `issuerIdentifiers` in an Annex C `deviceRequest`. The matcher then only
   * offers credentials carrying one of those identifiers, so a credential registered without them
   * never matches such a request. Requests that name no issuers match either way.
   */
  issuerAuthorityKeyIdentifiers?: string[]

  /**
   * Reader-auth gating, the Android counterpart of
   * {@link IosRegistrationOptions.supportedAuthorityKeyIdentifiers}.
   *
   * - **Empty (the default).** Every request matches, signed or not.
   * - **Non-empty.** Only requests whose reader certificate chain carries one of these authority
   *   key identifiers match: the `x5c` of a signed OpenID4VP request, or the `readerAuth` of an
   *   Annex C `deviceRequest`. Unsigned requests never match, and the user sees no entry for them.
   *
   * Registering these with any matcher other than `multipaz` throws, since it would silently offer
   * the credential to every reader.
   */
  supportedAuthorityKeyIdentifiers?: string[]
}

/**
 * Whether the wallet is allowed to provide identity documents.
 *
 * Mirrors `IdentityDocumentProviderRegistrationStore.Status` on iOS. On Android this is always
 * `authorized` when the API is available, since no user permission is involved.
 */
export type RegistrationStatus = 'authorized' | 'notAuthorized' | 'notDetermined' | 'notSupported'
