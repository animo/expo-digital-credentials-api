/**
 * Protocols the Digital Credentials API can carry.
 *
 * The `openid4vp-v1-*` variants are OpenID4VP 1.0, `openid4vp` the earlier draft identifier, and
 * `org-iso-mdoc` ISO/IEC TS 18013-7:2025 Annex C. iOS speaks the `openid4vp-v1-*` ones from 27.3.
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
   * The OpenID4VP authorization request (OpenID4VP 1.0 Appendix A.3): the parameters when unsigned,
   * `{ request }` when signed, `{ payload, signatures }` when multi-signed.
   */
  data: Record<string, unknown>
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
  kind: 'raw'

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
   * {@link DcApiCredential.supportedAuthorityKeyIdentifiers}.
   */
  certificateChain: string[]
}

/**
 * A request on iOS 27.3 or later, handed over in full as on Android but without a picker selection.
 * The wallet picks the answering credentials from its own storage.
 */
export interface IosRawDcApiRequest extends DcApiRequestActions {
  platform: 'ios'
  kind: 'raw'

  /**
   * WHATWG ASCII serialization of the requesting website origin. See
   * {@link AndroidDcApiRequest.origin}.
   *
   * Always present, unlike on Android: a request without one is cancelled before the UI is shown.
   */
  origin: string

  /** The one protocol request this wallet was picked for, or none when this package does not know its protocol. */
  requests: DcApiProtocolRequest[]
}

/** An Annex C request before iOS 27.3: what the OS parsed, until the wallet approves. */
export interface IosParsedDcApiRequest extends DcApiRequestActions<IsoMdocResponseOptions> {
  platform: 'ios'
  kind: 'parsed'

  /**
   * WHATWG ASCII serialization of the requesting website origin. See {@link IosRawDcApiRequest.origin}.
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
   * Call it only after the user approved: the OS releases the raw request when the wallet commits.
   * Resolves with exactly one `org-iso-mdoc` request.
   */
  approve(): Promise<IsoMdocProtocolRequest[]>
}

export type IosDcApiRequest = IosRawDcApiRequest | IosParsedDcApiRequest

/** A request that carries the protocol requests themselves: on Android, and on iOS from 27.3. */
export type DcApiRawRequest = AndroidDcApiRequest | IosRawDcApiRequest

/**
 * An incoming credential request, as passed to the component registered with `registerDcApiScreen`.
 *
 * Discriminated on `kind` (see {@link DcApiRawRequest} and {@link IosParsedDcApiRequest}), and on
 * `platform` for what only one platform has.
 */
export type DcApiRequest = DcApiRawRequest | IosParsedDcApiRequest

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
 * How the OS should treat one document. iOS only.
 */
export interface IosRegistrationOptions {
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
 * wallet's own request UI, drawn from {@link IosParsedDcApiRequest.presentmentRequests}
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
   * {@link IosParsedDcApiRequest.presentmentRequests}.
   */
  namespaces: Record<string, Record<string, DcApiClaimValue>>
}

export type SdJwtClaims = {
  [key: string]: DcApiClaimValue | SdJwtClaims | Array<DcApiClaimValue | SdJwtClaims>
}

/**
 * Registered on iOS from 27.3, when its `vct` or one of its {@link extendedVcts} is in the config
 * plugin's `ios.verifiableCredentialTypes`. {@link claims} are Android only.
 */
export interface DcApiSdJwtCredential {
  format: 'dc+sd-jwt'
  vct: string

  /**
   * The vcts the credential's type extends, from the `extends` chain of its type metadata. A request
   * for one of them matches the credential too, as it would when the wallet resolves the request
   * itself. On Android only the `multipaz` matcher reads this.
   */
  extendedVcts?: string[]

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
   * The base64 encoded X.509 authority key identifiers of the credential's issuer chain (the mdoc's
   * `x5chain`, the SD-JWT's `x5c`), matched against the issuers a verifier names in DCQL
   * `trusted_authorities` or Annex C `issuerIdentifiers`.
   *
   * Without them the credential still matches such requests on iOS, but not with the `multipaz`
   * matcher on Android. Read on iOS from 27, and on Android by `multipaz` only.
   */
  issuerAuthorityKeyIdentifiers?: string[]

  /**
   * Base64 encoded X.509 authority key identifiers of the readers trusted to ask. When set, only
   * signed requests chaining up to one of them match. Empty (the default) matches every request.
   *
   * Applied by the OS on iOS and by the `multipaz` matcher on Android, which compares identifiers
   * only, so the request UI still verifies the signature. Other Android matchers throw.
   */
  supportedAuthorityKeyIdentifiers?: string[]

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
 */
export interface AndroidRegistrationOptions {
  /**
   * The OpenID4VP `transaction_data` types the credential can authorize, such as
   * `urn:paso:sca:global:payment:1`.
   *
   * A credential query that `transaction_data` entries name in their `credential_ids` only matches
   * credentials that list the type of every one of them. Without types (the default), the credential
   * only matches the other queries.
   *
   * A matched payment of type `urn:paso:sca:global:payment:1` or
   * `urn:eudi:sca:eu.europa.ec:payment:single:1` is shown as a payment in the picker: the payee and
   * the amount from the payload, with the credential as the payment method. The matcher only reads
   * the request, so the transaction still has to be validated and shown in the request UI.
   *
   * Registering these with any matcher other than `multipaz` throws, since it ignores transaction data.
   */
  transactionDataTypes?: string[]

  /**
   * Only match credential queries carrying transaction data, so a payment card is not offered for a
   * request that only asks for its claims. Requires `transactionDataTypes`. Defaults to `false`.
   *
   * Registering this with any matcher other than `multipaz` throws, since it would offer the
   * credential to every request.
   */
  transactionDataOnly?: boolean
}

/**
 * Whether the wallet is allowed to provide identity documents.
 *
 * Mirrors `IdentityDocumentProviderRegistrationStore.Status` on iOS. On Android this is always
 * `authorized` when the API is available, since no user permission is involved.
 */
export type RegistrationStatus = 'authorized' | 'notAuthorized' | 'notDetermined' | 'notSupported'
