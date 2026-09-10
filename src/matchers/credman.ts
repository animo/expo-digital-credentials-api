import type { DcApiCredential, DcApiCredentialDisplay, SdJwtClaims } from '../types'
import { decodeBase64 } from '../util'
import type { ParsedSelection } from './index'

/**
 * The credential blob the CMWallet and Ubique matchers read: a little-endian offset to the JSON
 * payload, the concatenated icon bytes, then the JSON itself with `{start, length}` slices into
 * that icon region.
 *
 * Both matchers only answer OpenID4VP requests, and neither separates what it shows from what it
 * matches: Ubique draws `value` in the picker as well as comparing it, CMWallet shows only the
 * name. So nothing here is rendered for a person — `display.claims[].displayValue` is a Multipaz
 * override, and putting it in `value` would decide whether the credential matches at all.
 */
export function encodeCredmanCredentials(credentials: DcApiCredential[], { debug }: { debug?: boolean }): Uint8Array {
  const chunks: Uint8Array[] = []

  const icons = new Map<string, { bytes: Uint8Array; offset: number }>()
  for (const item of credentials) {
    icons.set(item.id, { bytes: decodeIcon(item.display.iconDataUrl), offset: 0 })
  }

  const totalIconSize = [...icons.values()].reduce((sum, icon) => sum + icon.bytes.length, 0)

  const offsetBuffer = new ArrayBuffer(4)
  new DataView(offsetBuffer).setInt32(0, 4 + totalIconSize, true)
  chunks.push(new Uint8Array(offsetBuffer))

  let currentOffset = 4
  for (const icon of icons.values()) {
    icon.offset = currentOffset
    chunks.push(icon.bytes)
    currentOffset += icon.bytes.length
  }

  const mdocCredentials: EncodedJson['credentials']['mso_mdoc'] = {}
  const sdJwtCredentials: EncodedJson['credentials']['dc+sd-jwt'] = {}

  for (const item of credentials) {
    // Every item got an entry in the loop above.
    const icon = icons.get(item.id) as { bytes: Uint8Array; offset: number }
    const credentialJson = {
      id: item.id,
      title: item.display.title,
      subtitle: item.display.subtitle,
      icon: icon.bytes.length > 0 ? { start: icon.offset, length: icon.bytes.length } : null,
    }

    if (item.credential.format === 'mso_mdoc') {
      const paths: EncodedJson['credentials']['mso_mdoc'][string][number]['paths'] = {}
      for (const [namespace, elements] of Object.entries(item.credential.namespaces)) {
        paths[namespace] = {}
        for (const [element, value] of Object.entries(elements)) {
          paths[namespace][element] = {
            value: value ?? undefined,
            display: displayName(item.display, [namespace, element]),
          }
        }
      }

      const forDoctype = mdocCredentials[item.credential.doctype] ?? []
      mdocCredentials[item.credential.doctype] = forDoctype
      forDoctype.push({ ...credentialJson, paths })
    } else {
      const forVct = sdJwtCredentials[item.credential.vct] ?? []
      sdJwtCredentials[item.credential.vct] = forVct
      forVct.push({ ...credentialJson, paths: sdJwtPaths(item.credential.claims, item.display, []) })
    }
  }

  const registryJson = {
    debug,
    credentials: { mso_mdoc: mdocCredentials, 'dc+sd-jwt': sdJwtCredentials },
  } satisfies EncodedJson

  chunks.push(new TextEncoder().encode(JSON.stringify(registryJson)))

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)

  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result
}

/**
 * Both matchers report a picked entry as JSON: the index of the protocol request it matched, plus
 * the credential id.
 *
 * The bundled builds only register single entries, so exactly one arrives, and the request it names
 * is exact.
 */
export function parseCredmanSelection(entryIds: string[]): ParsedSelection {
  const entries = entryIds.map((entryId) => {
    const selected = JSON.parse(entryId) as { provider_idx?: number; id?: string }
    if (typeof selected.id !== 'string') {
      throw new Error(`Unexpected selected entry id '${entryId}' for the cmwallet/ubique matcher`)
    }

    return { credentialId: selected.id, requestIndex: selected.provider_idx ?? 0 }
  })

  return {
    credentialIds: entries.map((entry) => entry.credentialId),
    requestIndexes: [...new Set(entries.map((entry) => entry.requestIndex))],
  }
}

function sdJwtPaths(claims: SdJwtClaims, display: DcApiCredentialDisplay, path: string[]): EncodedSdJwtPaths {
  const result: EncodedSdJwtPaths = {}

  for (const [key, value] of Object.entries(claims)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sdJwtPaths(value, display, [...path, key])
    } else {
      result[key] = {
        display: displayName(display, [...path, key]),
        // An array claim is registered for its path alone, and matched on nothing.
        value: Array.isArray(value) ? undefined : value ?? undefined,
      }
    }
  }

  return result
}

function displayName(display: DcApiCredentialDisplay, path: string[]) {
  const claim = display.claims?.find((claim) => claim.path.join('.') === path.join('.'))
  return claim?.displayName ?? (path[path.length - 1] as string)
}

function decodeIcon(iconDataUrl: DcApiCredentialDisplay['iconDataUrl']): Uint8Array {
  if (!iconDataUrl) return new Uint8Array(0)

  return decodeBase64(iconDataUrl.slice(iconDataUrl.indexOf(',') + 1))
}

type EncodedValue = string | number | boolean | undefined

interface EncodedCredentialJsonCommon {
  id: string
  title: string
  subtitle?: string
  icon?: { start: number; length: number } | null
}

type EncodedSdJwtPaths = {
  // top-level key
  [key: string]:
    | // end-value (everything except object, so also arrays)
    { value?: EncodedValue; display: string }
    // object
    | EncodedSdJwtPaths
}

interface EncodedJson {
  /**
   * Only supported in the ubique matcher
   */
  debug?: boolean

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
      Array<EncodedCredentialJsonCommon & { paths: EncodedSdJwtPaths }>
    >
  }
}
