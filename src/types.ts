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

/**
 * The document types Apple allows in the
 * `com.apple.developer.identity-document-services.document-provider.mobile-document-types`
 * entitlement. Registering any other document type fails on iOS.
 */
export const iosSupportedDocumentTypes = [
  'org.iso.18013.5.1.mDL',
  'org.iso.23220.photoid.1',
  'org.iso.23220.1.jp.mnc',
  'eu.europa.ec.eudi.pid.1',
  'eu.europa.ec.av.1',
] as const
export type IosSupportedDocumentType = (typeof iosSupportedDocumentTypes)[number]

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
   */
  respond(options: Response): Promise<void>

  /**
   * Decline the request. The reason is for logs only — the OS decides what the verifier sees.
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
   * The credential the user picked in the system credential picker, as passed to
   * {@link RegisterCredentialsOptions.credentials}.
   *
   * Absent when the request never went through the picker — a caller can reach the wallet through
   * `identitycredentials.action.GET_CREDENTIALS`, where nothing was selected. The wallet then picks
   * the credential itself, from {@link requests}, the way it has to on iOS.
   */
  selectedCredentialId?: string

  /**
   * Index into {@link requests}, identifying the request the picked entry was matched against.
   *
   * The picker returns whatever the wasm matcher wrote into the entry, so this is only as good as
   * the matcher: when its answer cannot be mapped onto {@link requests} — an unknown protocol, an
   * index past the end — it falls back to `0`. Wallets that can answer more than one protocol are
   * better off picking from {@link requests} themselves.
   */
  selectedRequestIndex: number
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
 * How the OS should treat one document. iOS only: Android registers a credential database its
 * matcher reads, and neither gate exists there.
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
   * Android has no equivalent. Its matchers surface unsigned requests too, and trust decisions
   * are made in the request UI, where the wallet has the full request.
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
  }>
}

export interface DcApiMdocCredential {
  format: 'mso_mdoc'
  doctype: string

  /**
   * The namespaces of the credential. Pass `null` for nested / complex attribute values, since
   * those cannot be matched on.
   */
  namespaces: Record<string, Record<string, string | number | boolean | null>>
}

export type SdJwtClaims = {
  [key: string]: string | number | boolean | Array<SdJwtClaims> | SdJwtClaims
}

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
  display: DcApiCredentialDisplay
  credential: DcApiMdocCredential | DcApiSdJwtCredential

  /**
   * Gates the OS applies to this credential while matching. iOS only, and ignored on Android.
   */
  ios?: IosRegistrationOptions
}

/**
 * Whether the wallet is allowed to provide identity documents.
 *
 * Mirrors `IdentityDocumentProviderRegistrationStore.Status` on iOS. On Android this is always
 * `authorized` when the API is available, since no user permission is involved.
 */
export type RegistrationStatus = 'authorized' | 'notAuthorized' | 'notDetermined' | 'notSupported'
