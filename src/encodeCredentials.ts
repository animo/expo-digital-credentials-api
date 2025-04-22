import { decodeBase64, encodeBase64 } from './util'

export interface CredentialDisplayData {
  // TODO: also align more with OID4VCI input?
  title: string
  subtitle?: string

  // data url of the image
  iconDataUrl?: `data:image/${'jpg' | 'png'};base64,${string}`

  /**
   * Allows for claim display metadata
   */
  claims?: Array<{
    // TODO: path can contain null for array selectors
    path: string[]

    displayName?: string
  }>
}

interface CredentialConfiguration {
  format: string
}

export interface CredentialItem {
  id: string
  display: CredentialDisplayData
  credential: CredentialConfigurationMdoc | CredentialConfigurationSdJwtDc
}

export interface CredentialConfigurationMdoc extends CredentialConfiguration {
  format: 'mso_mdoc'
  doctype: string

  /**
   * The namespaces of the credential. You can pass null
   * for nested / complex attribute values, as it's not possible
   * to do matching for those claims
   */
  namespaces: Record<string, Record<string, string | number | boolean | null>>

  // TODO: support claim name mapping
}

export type SdJwtDcClaims = {
  [key: string]: string | number | boolean | Array<SdJwtDcClaims> | SdJwtDcClaims
}

export interface CredentialConfigurationSdJwtDc extends CredentialConfiguration {
  format: 'dc+sd-jwt'
  vct: string

  /**
   * The decoded claims of the SD JWT DC, including the resolved disclosures.
   */
  claims: SdJwtDcClaims
}

interface IconEntry {
  iconValue: Uint8Array
  iconOffset: number
}

function recursivelyMapSdJwtDc(
  claims: SdJwtDcClaims,
  display: CredentialDisplayData,
  path: string[]
): EncodedSdJwtDcCredentialJsonPath {
  const result: EncodedSdJwtDcCredentialJsonPath = {}

  for (const [key, value] of Object.entries(claims)) {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      const claimDisplay = display.claims?.find((claim) => claim.path.join('.') === [...path, key].join('.'))
      const displayName = claimDisplay?.displayName ?? key

      result[key] = {
        display: displayName,
        // Do not allow matching based on array claims for now
        value: Array.isArray(value) ? undefined : value ?? undefined,
      }
    } else {
      result[key] = recursivelyMapSdJwtDc(value, display, [...path, key])
    }
  }

  return result
}

// TODO: we should allow registering a custom matcher and thus custom credential bytes structure
export function getEncodedCredentialsBase64(items: CredentialItem[]): string {
  const textEncoder = new TextEncoder()
  const chunks: Uint8Array[] = []

  // Create icon map
  const iconRecord: Record<string, IconEntry> = {}
  for (const item of items) {
    const iconBytes = item.display.iconDataUrl
      ? decodeBase64(
          item.display.iconDataUrl.replace('data:image/png;base64,', '').replace('data:image/jpg;base64,', '')
        )
      : new Uint8Array(0)
    iconRecord[item.id] = { iconValue: iconBytes, iconOffset: 0 }
  }

  // Calculate total icon size
  const totalIconSize = Object.values(iconRecord).reduce((sum, icon) => sum + icon.iconValue.length, 0)

  // Calculate and write JSON offset (4 bytes, little endian)
  const jsonOffset = 4 + totalIconSize
  const offsetBuffer = new ArrayBuffer(4)
  new DataView(offsetBuffer).setInt32(0, jsonOffset, true)
  chunks.push(new Uint8Array(offsetBuffer))

  // Write icons and update offsets
  let currentOffset = 4
  for (const icon of Object.values(iconRecord)) {
    icon.iconOffset = currentOffset
    chunks.push(icon.iconValue)
    currentOffset += icon.iconValue.length
  }

  // Create credential JSON structure
  // Mapping of doctype/vct => credentials[]
  const mdocCredentials: EncodedJson['credentials']['mso_mdoc'] = {}
  const sdJwtCredentials: EncodedJson['credentials']['dc+sd-jwt'] = {}

  for (const item of items) {
    const icon = iconRecord[item.id]
    const credentialJson = {
      id: item.id,
      title: item.display.title,
      subtitle: item.display.subtitle,
      icon:
        icon.iconValue.length > 0
          ? {
              start: iconRecord[item.id].iconOffset,
              length: iconRecord[item.id].iconValue.length,
            }
          : null,
    }

    if (item.credential.format === 'mso_mdoc') {
      const pathsJson: EncodedJson['credentials']['mso_mdoc'][string][number]['paths'] = {}
      for (const [namespace, elements] of Object.entries(item.credential.namespaces)) {
        pathsJson[namespace] = {}
        for (const [element, value] of Object.entries(elements)) {
          const claimDisplay = item.display.claims?.find(
            (claim) => claim.path.join('.') === [namespace, element].join('.')
          )
          const displayName = claimDisplay?.displayName ?? element
          pathsJson[namespace][element] = {
            value: value ?? undefined,
            display: displayName,
          }
        }
      }

      // Add to doctype array
      if (!mdocCredentials[item.credential.doctype]) {
        mdocCredentials[item.credential.doctype] = []
      }
      mdocCredentials[item.credential.doctype].push({
        ...credentialJson,
        paths: pathsJson,
      })
    } else if (item.credential.format === 'dc+sd-jwt') {
      const pathsJson = recursivelyMapSdJwtDc(item.credential.claims, item.display, [])

      // Add to vct array
      if (!sdJwtCredentials[item.credential.vct]) {
        sdJwtCredentials[item.credential.vct] = []
      }
      sdJwtCredentials[item.credential.vct].push({
        ...credentialJson,
        paths: pathsJson,
      })
    } else {
      throw new Error('Unsupported format. Only mso_mdoc supported')
    }
  }

  // Create final JSON structure
  const registryJson = {
    credentials: {
      mso_mdoc: mdocCredentials,
      'dc+sd-jwt': sdJwtCredentials,
    },
  } satisfies EncodedJson

  // Convert JSON to bytes and add to chunks
  chunks.push(textEncoder.encode(JSON.stringify(registryJson)))

  // Combine all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return encodeBase64(result)
}

type EncodedValue = string | number | boolean | undefined

interface EncodedCredentialJsonCommon {
  id: string
  title: string
  subtitle?: string
  icon?: {
    start: number
    length: number
  } | null
}

type EncodedSdJwtDcCredentialJsonPath = {
  // top-level key
  [key: string]:
    | // end-value (everything except object, so also arrays)
    { value?: EncodedValue; display: string }
    // object
    | EncodedSdJwtDcCredentialJsonPath
}

interface EncodedJson {
  credentials: {
    mso_mdoc: Record<
      // doctype
      string,
      Array<
        EncodedCredentialJsonCommon & {
          paths: Record<
            // namespace
            string,
            Record<
              // element
              string,
              { value?: EncodedValue; display: string }
            >
          >
        }
      >
    >

    'dc+sd-jwt': Record<
      // vct value
      string,
      Array<
        EncodedCredentialJsonCommon & {
          paths: EncodedSdJwtDcCredentialJsonPath
        }
      >
    >
  }
}
