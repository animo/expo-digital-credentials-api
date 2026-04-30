import { decodeBase64, stripImageDataUrl } from './util'

export interface IssuanceDisplayData {
  title: string
  subtitle?: string
  iconDataUrl?: `data:image/${'jpg' | 'png'};base64,${string}`
}

export interface IssuanceRegistryOptions {
  display: IssuanceDisplayData
  issuerAllowlist?: string[]
}

export function encodeIssuanceCreationOptions(options: IssuanceRegistryOptions): Uint8Array {
  const textEncoder = new TextEncoder()

  const iconBytes = options.display.iconDataUrl
    ? decodeBase64(stripImageDataUrl(options.display.iconDataUrl))
    : new Uint8Array(0)

  // Write offset (4 bytes LE) + icon bytes + JSON
  const jsonOffset = 4 + iconBytes.length
  const offsetBuffer = new ArrayBuffer(4)
  new DataView(offsetBuffer).setInt32(0, jsonOffset, true)

  const chunks: Uint8Array[] = [new Uint8Array(offsetBuffer), iconBytes]

  const json = {
    display: {
      title: options.display.title,
      subtitle: options.display.subtitle,
      icon:
        iconBytes.length > 0
          ? {
              start: 4,
              length: iconBytes.length,
            }
          : null,
    },
    capabilities:
      options.issuerAllowlist && options.issuerAllowlist.length > 0
        ? Object.fromEntries(options.issuerAllowlist.map((iss) => [iss, {}]))
        : undefined,
  }

  const jsonBytes = textEncoder.encode(JSON.stringify(json))
  chunks.push(jsonBytes)

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result
}
