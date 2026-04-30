
/**
 * Raw ProviderGetCredentialRequest bundle JSON.
 *
 * The Android layer passes through the full request bundle as-is.
 * Treat the payload as JSON (stringly typed).
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type JsonObject = { [key: string]: JsonValue }

/**
 * CMWallet parses GetDigitalCredentialOption.requestJson into one of these shapes.
 */
export type DigitalCredentialRequestOptions =
  | DigitalCredentialRequestOptionsModern
  | DigitalCredentialRequestOptionsLegacy

export type DigitalCredentialRequestOptionsModern = {
  requests: DigitalCredentialRequestEntry[]
}

export type DigitalCredentialRequestOptionsLegacy = {
  providers: DigitalCredentialRequestLegacyEntry[]
}

export type DigitalCredentialRequestEntry = {
  protocol: string
  data: OpenId4vpRequest | OpenId4vciRequest | JsonValue
}

export type DigitalCredentialRequestLegacyEntry = {
  protocol: string
  request: string
}

/**
 * OpenID4VP request object (data payload) as used by CMWallet.
 * If `request` is present, CMWallet treats it as a signed request and
 * replaces the object with the JWS payload.
 */
export type OpenId4vpRequest = JsonObject & {
  nonce: string
  dcql_query: JsonObject
  request?: string
  client_id?: string
  offer?: JsonObject
  client_metadata?: OpenId4vpClientMetadata
  response_mode?: string
  transaction_data?: string[]
}

export type OpenId4vpClientMetadata = JsonObject & {
  jwks?: {
    keys: Jwk[]
  }
}

export type Jwk = JsonObject & {
  kty?: string
  crv?: string
  use?: string
}

/**
 * OpenID4VCI request payload (data object).
 * CMWallet passes this JSON object to its OpenId4VCI parser.
 */
export type OpenId4vciRequest = JsonObject

export type DigitalCredentialsRequest = {
  /**
   * Normalized request JSON extracted from the Android bundle.
   */
  request?: DigitalCredentialRequestOptions

  /**
   * Origin of the request when provided by the system.
   */
  origin?: string | null

  /**
   * Calling package name when provided by the system.
   */
  packageName?: string

  /**
   * Calling app signing info (raw string) when provided by the system.
   */
  signingInfo?: string

  /**
   * Normalized credential option entries (Android).
   */
  credentialOptions?: Array<{
    type?: string
    allowedProviders?: JsonValue
    isSystemProviderRequired?: boolean
    candidateQueryData?: JsonObject
    retrievalData?: JsonObject
  }>

  /**
   * Legacy selection info derived from selectedEntryId.
   */
  selectedEntry?: {
    credentialId: string
    providerIndex: number
  }

  /**
   * Detailed selection info (supports multiple credential selections).
   */
  selection?: {
    requestIdx: number
    creds: Array<{
      entryId: string
      matchedClaimPaths?: Array<Array<string | number | null>>
      metadata?: JsonObject
    }>
  }

  /**
   * Raw ProviderGetCredentialRequest bundle JSON (Android), for debugging.
   */
  sourceBundle?: JsonObject

  /**
   * Additional raw keys, if any.
   */
  [key: string]: JsonValue | undefined
}

export interface DigitalCredentialsCreateRequest {
  /**
   * e.g. `https://digital-credentials.dev`
   */
  origin: string | null

  /**
   * e.g. `com.android.chrome`
   */
  packageName: string

  /**
   * Credential type for the request.
   */
  type: string

  /**
   * Request payload (if provided by the system).
   */
  request: {
    /**
     * Protocol identifier for the create request.
     */
    protocol: string

    /**
     * Protocol-specific payload (raw JSON).
     */
    data: JsonValue
  } | null
}

export interface RegisterCredentialsOptions {
  /**
   * Raw credential registry bytes to pass to the matcher.
   */
  credentialBytes: Uint8Array

  /**
   * Matcher wasm bytes to use for selection.
   */
  matcherBytes: Uint8Array

  /**
   * Protocol identifier to register against. Defaults to `openid4vp` if omitted.
   */
  protocol?: string

  /**
   * Credential type to register. Defaults to Android's Digital Credential type if omitted.
   */
  type?: string

  /**
   * Whether to register the legacy CredMan type for backwards compatibility.
   * Defaults to true.
   */
  registerCompatType?: boolean
}

export interface RegisterCreationOptionsOptions {
  /**
   * Raw creation options bytes to pass to the matcher.
   */
  creationOptions: Uint8Array

  /**
   * Matcher wasm bytes to use for issuance selection.
   */
  matcherBytes: Uint8Array

  /**
   * Credential type to register. Defaults to Android's Digital Credential type if omitted.
   */
  type?: string

  /**
   * Identifier for the creation options registration.
   *
   * Defaults to `openid4vci`.
   */
  id?: string

  /**
   * Optional intent action for creation options.
   *
   * Defaults to empty string.
   */
  intentAction?: string
}

export interface SendResponseOptions {
  /**
   * Serialized response to return to the requesting app.
   */
  response: string
}

export interface SendErrorResponseOptions {
  /**
   * Error message to return to the requesting app.
   */
  errorMessage: string
}

export interface SendCreateResponseOptions {
  /**
   * Serialized create response to return to the requesting app.
   */
  response: string

  /**
   * Optional credential type for the response.
   */
  type?: string

  /**
   * Optional entry id of the newly created credential.
   */
  newEntryId?: string
}

export interface SendCreateErrorResponseOptions {
  /**
   * Error message to return to the requesting app.
   */
  errorMessage: string
}

export interface SetAllowedAppsOptions {
  /**
   * JSON payload describing allowed apps for origin verification.
   * Pass null or an empty string to clear the override and use the bundled default.
   */
  allowedAppsJson?: string | null
}

export type OnRequestEventPayload = {
  /**
   * Raw JSON request payload as a string.
   */
  request: string
}

export type DigitalCredentialsApiModuleEvents = {
  /**
   * Fired when a request is received (not currently emitted by the native module).
   */
  onRequest: (params: OnRequestEventPayload) => void
}
