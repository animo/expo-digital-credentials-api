import { decodeBase64, encodeBase64 } from './util'

export interface CredentialDisplayData {
  title: string
  subtitle?: string
  // data url of the image. Should start with
  iconDataUrl?: `data:image/jpeg;base64,${string}`
}

interface CredentialConfiguration {
  format: string
}

export interface CredentialItem {
  id: string
  display: CredentialDisplayData
  credential: CredentialConfigurationMdoc
}

export interface CredentialConfigurationMdoc extends CredentialConfiguration {
  format: 'mso_mdoc'
  doctype: string

  // TODO: support nested structures
  namespaces: Record<string, Record<string, string | number | boolean>>

  // TODO: support claim name mapping
}

interface IconEntry {
  iconValue: Uint8Array
  iconOffset: number
}

// TODO: we should allow registering a custom matcher and thus custom credential bytes structure
export function getEncodedCredentialsBase64(items: CredentialItem[]): string {
  const textEncoder = new TextEncoder()
  const chunks: Uint8Array[] = []

  // Create icon map
  const iconRecord: Record<string, IconEntry> = {}
  for (const item of items) {
    const iconBytes = item.display.iconDataUrl
      ? decodeBase64(item.display.iconDataUrl.replace('data:image/jpeg;base64,', ''))
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
  // Mapping of doctype => credentials[]
  const mdocCredentials: EncodedJson['credentials']['mso_mdoc'] = {}

  for (const item of items) {
    if (item.credential.format === 'mso_mdoc') {
      const namespacesJson = {}
      for (const [namespace, elements] of Object.entries(item.credential.namespaces)) {
        namespacesJson[namespace] = {}
        for (const [element, value] of Object.entries(elements)) {
          namespacesJson[namespace][element] = {
            value,
            // TODO: display mapping
            display: element,
          }
        }
      }

      const credentialJson = {
        id: item.id,
        title: item.display.title,
        subtitle: item.display.subtitle,
        icon: {
          start: iconRecord[item.id].iconOffset,
          length: iconRecord[item.id].iconValue.length,
        },
        namespaces: namespacesJson,
      }

      // Add to doctype array
      if (!mdocCredentials[item.credential.doctype]) {
        mdocCredentials[item.credential.doctype] = []
      }
      mdocCredentials[item.credential.doctype].push(credentialJson)
    } else {
      throw new Error('Unsupported format. Only mso_mdoc supported')
    }
  }

  // Create final JSON structure
  const registryJson = {
    credentials: {
      mso_mdoc: mdocCredentials,
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

interface EncodedJson {
  credentials: {
    mso_mdoc: Record<
      string,
      Array<{
        id: string
        title: string
        subtitle?: string
        // TOOD: optional?
        icon?: {
          start: number
          length: number
        }
        namespaces: Record<
          // namespace
          string,
          Record<
            // element
            string,
            { value: string; display: string }
          >
        >
      }>
    >
  }
}
