export type RegistryValue = string | number | boolean

export interface RegistryIconPointer {
  /**
   * Byte offset into the registry payload where the icon bytes start.
   */
  start: number

  /**
   * Byte length of the icon data.
   */
  length: number
}

export interface RegistryCredentialCommon {
  /**
   * Credential identifier used by the matcher.
   */
  id: string

  /**
   * Human-readable title for display.
   */
  title: string

  /**
   * Optional subtitle for display.
   */
  subtitle?: string

  /**
   * Optional icon pointer (or null) into the registry payload.
   */
  icon?: RegistryIconPointer | null
}

export type RegistrySdJwtPath =
  | {
      value?: RegistryValue
      display: string
    }
  | RegistrySdJwtPaths

export type RegistrySdJwtPaths = {
  [key: string]: RegistrySdJwtPath
}

export interface MatcherRegistryJson {
  credentials: {
    mso_mdoc: Record<
      string,
      Array<
        RegistryCredentialCommon & {
          /**
           * Claim paths indexed by namespace and element name.
           */
          paths: Record<string, Record<string, { value?: RegistryValue; display: string }>>
        }
      >
    >
    'dc+sd-jwt': Record<
      string,
      Array<
        RegistryCredentialCommon & {
          /**
           * Claim paths indexed by claim key hierarchy.
           */
          paths: RegistrySdJwtPaths
        }
      >
    >
  }
}

/**
 * Matcher registry bytes layout:
 * - 4-byte little-endian offset to the JSON payload
 * - concatenated icon bytes
 * - UTF-8 JSON matching MatcherRegistryJson
 */
export type MatcherRegistryBytes = Uint8Array
