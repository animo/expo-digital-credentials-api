export type ClaimsPathPointer = Array<string | number | null>

export type AptitudeConsortiumLogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace'

export type AptitudeConsortiumOpenId4VpRequestProtocol =
  | 'openid4vp-v1-unsigned'
  | 'openid4vp-v1-signed'
  | 'openid4vp-v1-multisigned'
  | (string & {})

export type AptitudeConsortiumOpenId4VpResponseMode = 'dc_api' | 'dc_api.jwt' | (string & {})

export type AptitudeConsortiumOpenId4VpResponseType = 'vp_token' | (string & {})

export type AptitudeConsortiumOpenId4VpQueryMethod = 'dcql_query' | (string & {})

export type AptitudeConsortiumOpenId4VpRequestParameter = 'transaction_data' | (string & {})

export interface AptitudeConsortiumOpenId4VpConfig {
  /**
   * Enable OpenID4VP handling.
   */
  enabled?: boolean
  /**
   * DC API protocol variants the matcher should accept.
   */
  supported_request_protocols?: AptitudeConsortiumOpenId4VpRequestProtocol[]
  /**
   * OpenID4VP response modes the matcher should accept.
   */
  supported_response_modes?: AptitudeConsortiumOpenId4VpResponseMode[]
  /**
   * OpenID4VP response types the matcher should accept when present.
   */
  supported_response_types?: AptitudeConsortiumOpenId4VpResponseType[]
  /**
   * Query mechanisms the matcher should accept.
   */
  supported_query_methods?: AptitudeConsortiumOpenId4VpQueryMethod[]
  /**
   * Extra request parameters the matcher should process.
   */
  supported_request_parameters?: AptitudeConsortiumOpenId4VpRequestParameter[]
}

export type AptitudeConsortiumCredentialSetOptionMode = 'all_satisfiable' | 'first_satisfiable_only'

export type AptitudeConsortiumOptionalCredentialSetsMode =
  | 'prefer_present'
  | 'prefer_absent'
  | 'always_present_if_satisfiable'

export interface AptitudeConsortiumPlanOptions {
  /**
   * How to choose between credential set options.
   */
  credential_set_option_mode?: AptitudeConsortiumCredentialSetOptionMode
  /**
   * How to handle optional credential sets.
   */
  optional_credential_sets_mode?: AptitudeConsortiumOptionalCredentialSetsMode
}

export type AptitudeConsortiumTransactionDataValueType =
  | 'boolean'
  | 'frequency'
  | 'image'
  | 'iso_date'
  | 'iso_time'
  | 'iso_date_time'
  | 'iso_currency'
  | 'iso_currency_amount'
  | 'label_only'
  | 'mini_markdown'
  | 'url'
  | (string & {})

export interface AptitudeConsortiumLocalizedLabel {
  /**
   * Locale for the label (BCP-47). Accepted for compatibility, not rendered.
   */
  locale?: string
  /**
   * Display name text. Accepted for compatibility, not rendered.
   */
  name?: string
  /**
   * Legacy alias for `name`.
   */
  label?: string
  /**
   * Optional description text.
   */
  description?: string
  /**
   * Optional formatter metadata. Accepted for compatibility, not rendered.
   */
  display_type?: AptitudeConsortiumTransactionDataValueType
}

export interface AptitudeConsortiumClaimConfig {
  /**
   * Claim path pointer relative to `transaction_data.payload`.
   */
  path: ClaimsPathPointer
  /**
   * Whether this payload claim must be present.
   */
  mandatory?: boolean
  /**
   * Optional TS12 payload value constraint.
   */
  value_type?: AptitudeConsortiumTransactionDataValueType
  /**
   * Non-empty TS12 display metadata marks the claim as displayable for payload validation.
   * Contents are accepted for compatibility and are not rendered as Credential Manager fields.
   */
  display?: AptitudeConsortiumLocalizedLabel[]
}

export interface AptitudeConsortiumTransactionDataConfig {
  /**
   * Transaction data type URN.
   */
  type: string
  /**
   * Claim metadata used to validate `transaction_data.payload`.
   */
  claims?: AptitudeConsortiumClaimConfig[]
}

export type AptitudeConsortiumTransactionDataTypesConfig =
  | Record<string, Omit<AptitudeConsortiumTransactionDataConfig, 'type'>>
  | AptitudeConsortiumTransactionDataConfig[]

export interface AptitudeConsortiumPaymentScaTypeConfig {
  /**
   * Payee/merchant display path in the full transaction data object.
   */
  payee: ClaimsPathPointer
  /**
   * Amount display path in the full transaction data object.
   */
  amount: ClaimsPathPointer
  /**
   * Optional extra context shown in payment UI.
   */
  additional_info?: ClaimsPathPointer
}

export type AptitudeConsortiumPaymentScaConfig =
  | Record<string, AptitudeConsortiumPaymentScaTypeConfig>
  | Array<AptitudeConsortiumPaymentScaTypeConfig & { type: string }>

export type AptitudeConsortiumIcon = string | number[]

export interface AptitudeConsortiumFieldConfig {
  /**
   * Claim path pointer for this field.
   */
  path: ClaimsPathPointer
  /**
   * Display label for the field.
   */
  display_name: string
  /**
   * Optional display value override.
   */
  display_value?: string
}

export interface AptitudeConsortiumCredentialConfig {
  /**
   * Optional credential id.
   */
  id?: string
  /**
   * Credential format identifier.
   */
  format: string
  /**
   * Display title.
   */
  title?: string
  /**
   * Display subtitle.
   */
  subtitle?: string
  /**
   * Optional disclaimer text.
   */
  disclaimer?: string
  /**
   * Optional warning text.
   */
  warning?: string
  /**
   * Display field definitions.
   */
  fields?: AptitudeConsortiumFieldConfig[]
  /**
   * Optional credential metadata. Standard claim display names may be read from this object.
   */
  metadata?: unknown
  /**
   * Icon bytes (base64 string without data URL prefix) or raw number array.
   */
  icon?: AptitudeConsortiumIcon
  /**
   * Accepted VCTs for SD-JWT credentials.
   */
  vcts?: string[]
  /**
   * Document type for mDOC credentials.
   */
  doctype?: string
  /**
   * Whether holder binding is required.
   */
  holder_binding?: boolean
  /**
   * Optional claims definition.
   */
  claims?: unknown
  /**
   * Transaction data types supported by this credential.
   */
  transaction_data_types?: AptitudeConsortiumTransactionDataTypesConfig
}

export interface AptitudeConsortiumConfig {
  /**
   * Default id prefix for generated credential ids.
   */
  default_id_prefix?: string
  /**
   * OpenID4VP configuration.
   */
  openid4vp?: AptitudeConsortiumOpenId4VpConfig
  /**
   * DCQL planning options.
   */
  dcql?: AptitudeConsortiumPlanOptions
  /**
   * Dedicated payment/SCA display mappings.
   */
  payment_sca?: AptitudeConsortiumPaymentScaConfig
  /**
   * Matcher log level.
   */
  log_level?: AptitudeConsortiumLogLevel
  /**
   * Credential registry entries.
   */
  credentials?: AptitudeConsortiumCredentialConfig[]
}
