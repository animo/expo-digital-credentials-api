import type {
  AptitudeConsortiumConfig,
  AptitudeConsortiumCredentialConfig,
} from '@animo-id/expo-digital-credentials-api-aptitude-consortium'

export type AptitudeConsortiumIconInput = Uint8Array | number[] | string

export type AptitudeConsortiumCredentialConfigInput = Omit<AptitudeConsortiumCredentialConfig, 'icon'> & {
  icon?: AptitudeConsortiumIconInput
}

export type AptitudeConsortiumConfigInput = Omit<AptitudeConsortiumConfig, 'credentials'> & {
  credentials?: AptitudeConsortiumCredentialConfigInput[]
}

function normalizeAptitudeIcon(icon: AptitudeConsortiumIconInput): string | number[] {
  if (icon instanceof Uint8Array) return Array.from(icon)

  if (typeof icon === 'string') {
    if (icon.startsWith('data:')) {
      const commaIndex = icon.indexOf(',')
      return commaIndex >= 0 ? icon.slice(commaIndex + 1) : icon
    }
    return icon
  }

  return icon
}

function normalizeAptitudeCredential(
  credential: AptitudeConsortiumCredentialConfigInput
): AptitudeConsortiumCredentialConfig {
  if (!credential.icon) return credential as AptitudeConsortiumCredentialConfig

  return {
    ...credential,
    icon: normalizeAptitudeIcon(credential.icon),
  }
}

export function normalizeAptitudeConsortiumConfig(
  config: AptitudeConsortiumConfigInput,
  { debug }: { debug?: boolean } = {}
): AptitudeConsortiumConfig {
  const normalized: AptitudeConsortiumConfig = {
    ...(config as Omit<AptitudeConsortiumConfig, 'credentials'>),
  }

  if (debug && !normalized.log_level) {
    normalized.log_level = 'debug'
  }

  if (config.credentials) {
    normalized.credentials = config.credentials.map(normalizeAptitudeCredential)
  }

  return normalized
}
