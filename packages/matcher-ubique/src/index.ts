import { registerCredentials as registerCredentialsRaw } from '@animo-id/expo-digital-credentials-api'
import { encodeCredentials, type CredentialItem, type SdJwtDcClaims, type CredentialDisplayData } from './encodeCredentials'
import { loadMatcherBytes } from './matcherBytes'
import type {
  MatcherRegistryBytes,
  MatcherRegistryJson,
  RegistryCredentialCommon,
  RegistryIconPointer,
  RegistrySdJwtPaths,
  RegistryValue,
} from './schema'

export type {
  CredentialItem,
  SdJwtDcClaims,
  CredentialDisplayData,
  MatcherRegistryBytes,
  MatcherRegistryJson,
  RegistryCredentialCommon,
  RegistryIconPointer,
  RegistrySdJwtPaths,
  RegistryValue,
}
export { encodeCredentials, loadMatcherBytes }

export interface RegisterCredentialsOptions {
  /**
   * Unencoded credential registry entries.
   */
  credentials?: CredentialItem[]
  /**
   * Pre-encoded registry bytes (advanced usage).
   */
  credentialsBytes?: Uint8Array
  /**
   * Optional debug flag (included in registry JSON).
   */
  debug?: boolean
  matcherBytes?: Uint8Array
  protocol?: string
  type?: string
  registerCompatType?: boolean
}

export async function registerCredentials(options: RegisterCredentialsOptions): Promise<void> {
  const credentialsBytes =
    options.credentialsBytes ??
    (options.credentials ? encodeCredentials(options.credentials, { debug: options.debug }) : null)
  if (!credentialsBytes) {
    throw new Error('Either credentials or credentialsBytes must be provided.')
  }
  const matcherBytes = options.matcherBytes ?? (await loadMatcherBytes())
  return registerCredentialsRaw({
    credentialBytes: credentialsBytes,
    matcherBytes,
    protocol: options.protocol ?? 'openid4vp',
    type: options.type,
    registerCompatType: options.registerCompatType,
  })
}
