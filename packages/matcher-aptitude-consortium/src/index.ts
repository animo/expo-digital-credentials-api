import { registerCredentials as registerCredentialsRaw } from '@animo-id/expo-digital-credentials-api'
import { loadMatcherBytes } from './matcherBytes'
import type {
  AptitudeConsortiumClaimConfig,
  AptitudeConsortiumConfig,
  AptitudeConsortiumCredentialConfig,
  AptitudeConsortiumCredentialSetOptionMode,
  AptitudeConsortiumFieldConfig,
  AptitudeConsortiumIcon,
  AptitudeConsortiumLocalizedLabel,
  AptitudeConsortiumLogLevel,
  AptitudeConsortiumOpenId4VpConfig,
  AptitudeConsortiumOpenId4VpQueryMethod,
  AptitudeConsortiumOpenId4VpRequestParameter,
  AptitudeConsortiumOpenId4VpRequestProtocol,
  AptitudeConsortiumOpenId4VpResponseMode,
  AptitudeConsortiumOpenId4VpResponseType,
  AptitudeConsortiumOptionalCredentialSetsMode,
  AptitudeConsortiumPaymentScaConfig,
  AptitudeConsortiumPaymentScaTypeConfig,
  AptitudeConsortiumPlanOptions,
  AptitudeConsortiumTransactionDataConfig,
  AptitudeConsortiumTransactionDataTypesConfig,
  AptitudeConsortiumTransactionDataValueType,
  ClaimsPathPointer,
} from './schema'
import type {
  AptitudeSelectionCredential,
  AptitudeSelectionMetadata,
  AptitudeSelectionSlot,
  AptitudeSelectionTransactionData,
  DigitalCredentialsRequestWithAptitudeSelection,
} from './selection'
import { getAptitudeSelection } from './selection'

export type {
  AptitudeConsortiumClaimConfig,
  AptitudeConsortiumConfig,
  AptitudeConsortiumCredentialConfig,
  AptitudeConsortiumCredentialSetOptionMode,
  AptitudeConsortiumFieldConfig,
  AptitudeConsortiumIcon,
  AptitudeConsortiumLogLevel,
  AptitudeConsortiumLocalizedLabel,
  AptitudeConsortiumOptionalCredentialSetsMode,
  AptitudeConsortiumOpenId4VpConfig,
  AptitudeConsortiumOpenId4VpQueryMethod,
  AptitudeConsortiumOpenId4VpRequestParameter,
  AptitudeConsortiumOpenId4VpRequestProtocol,
  AptitudeConsortiumOpenId4VpResponseMode,
  AptitudeConsortiumOpenId4VpResponseType,
  AptitudeConsortiumPaymentScaConfig,
  AptitudeConsortiumPaymentScaTypeConfig,
  AptitudeConsortiumPlanOptions,
  AptitudeConsortiumTransactionDataTypesConfig,
  AptitudeConsortiumTransactionDataValueType,
  AptitudeConsortiumTransactionDataConfig,
  ClaimsPathPointer,
  AptitudeSelectionCredential,
  AptitudeSelectionMetadata,
  AptitudeSelectionSlot,
  AptitudeSelectionTransactionData,
  DigitalCredentialsRequestWithAptitudeSelection,
}

export { loadMatcherBytes }
export { getAptitudeSelection }

export const DEFAULT_APTITUDE_CONSORTIUM_OPENID4VP_CONFIG: Required<AptitudeConsortiumOpenId4VpConfig> = {
  enabled: true,
  supported_request_protocols: ['openid4vp-v1-unsigned', 'openid4vp-v1-signed', 'openid4vp-v1-multisigned'],
  supported_response_modes: ['dc_api', 'dc_api.jwt'],
  supported_response_types: ['vp_token'],
  supported_query_methods: ['dcql_query'],
  supported_request_parameters: ['transaction_data'],
}

export const DEFAULT_APTITUDE_CONSORTIUM_CONFIG: AptitudeConsortiumConfig = {
  openid4vp: DEFAULT_APTITUDE_CONSORTIUM_OPENID4VP_CONFIG,
  payment_sca: {},
}

export function withDefaultAptitudeConsortiumConfig(config: AptitudeConsortiumConfig = {}): AptitudeConsortiumConfig {
  const openid4vp = config.openid4vp ?? {}

  return {
    ...config,
    payment_sca: config.payment_sca ?? DEFAULT_APTITUDE_CONSORTIUM_CONFIG.payment_sca,
    openid4vp: {
      enabled: openid4vp.enabled ?? DEFAULT_APTITUDE_CONSORTIUM_OPENID4VP_CONFIG.enabled,
      supported_request_protocols: openid4vp.supported_request_protocols ?? [
        ...DEFAULT_APTITUDE_CONSORTIUM_OPENID4VP_CONFIG.supported_request_protocols,
      ],
      supported_response_modes: openid4vp.supported_response_modes ?? [
        ...DEFAULT_APTITUDE_CONSORTIUM_OPENID4VP_CONFIG.supported_response_modes,
      ],
      supported_response_types: openid4vp.supported_response_types ?? [
        ...DEFAULT_APTITUDE_CONSORTIUM_OPENID4VP_CONFIG.supported_response_types,
      ],
      supported_query_methods: openid4vp.supported_query_methods ?? [
        ...DEFAULT_APTITUDE_CONSORTIUM_OPENID4VP_CONFIG.supported_query_methods,
      ],
      supported_request_parameters: openid4vp.supported_request_parameters ?? [
        ...DEFAULT_APTITUDE_CONSORTIUM_OPENID4VP_CONFIG.supported_request_parameters,
      ],
    },
  }
}

export function encodeAptitudeConsortiumConfig(config: AptitudeConsortiumConfig = {}): Uint8Array {
  const textEncoder = new TextEncoder()
  return textEncoder.encode(JSON.stringify(withDefaultAptitudeConsortiumConfig(config)))
}

export interface RegisterCredentialsOptions {
  /**
   * Unencoded Aptitude Consortium config.
   */
  aptitudeConsortiumConfig?: AptitudeConsortiumConfig
  /**
   * Pre-encoded registry bytes (advanced usage).
   */
  credentialsBytes?: Uint8Array
  matcherBytes?: Uint8Array
  protocol?: string
  type?: string
  registerCompatType?: boolean
}

export async function registerCredentials(options: RegisterCredentialsOptions = {}): Promise<void> {
  const credentialsBytes = options.credentialsBytes ?? encodeAptitudeConsortiumConfig(options.aptitudeConsortiumConfig)
  const matcherBytes = options.matcherBytes ?? (await loadMatcherBytes())

  return registerCredentialsRaw({
    credentialBytes: credentialsBytes,
    matcherBytes,
    protocol: options.protocol ?? 'openid4vp',
    type: options.type,
    registerCompatType: options.registerCompatType,
  })
}
