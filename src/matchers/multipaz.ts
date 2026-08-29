import type { DcApiCredential, DcApiCredentialDisplay, DcApiProtocol, SdJwtClaims } from '../types'
import { decodeBase64 } from '../util'
import { type CborValue, encodeCbor } from './cbor'

/**
 * The credential database the Multipaz matcher reads (`CredentialDatabase.cpp`):
 *
 * ```
 * {
 *   "protocols": [tstr],
 *   "credentials": [{
 *     "title": tstr, "subtitle": tstr, "bitmap": bstr,
 *     "protocols": [tstr],                                  ; optional, overrides the top level
 *     "mdoc":  { "documentId": tstr, "docType": tstr,
 *                "namespaces": { ns: { element: [display, value, matchValue] } } },
 *     "sdjwt": { "documentId": tstr, "vct": tstr,
 *                "claims": { "a.b.c": [display, value, matchValue] } }
 *   }]
 * }
 * ```
 *
 * `title`, `subtitle` and `bitmap` are read unconditionally, so they are always written.
 */
export function encodeMultipazCredentials(credentials: DcApiCredential[], protocols: DcApiProtocol[]): Uint8Array {
  return encodeCbor({
    protocols,
    credentials: credentials.map(encodeCredential),
  })
}

function encodeCredential({ id, display, credential }: DcApiCredential): CborValue {
  const common = {
    title: display.title,
    subtitle: display.subtitle ?? '',
    bitmap: decodeIcon(display.iconDataUrl),
  }

  if (credential.format === 'mso_mdoc') {
    const namespaces: CborValue = {}
    for (const [namespace, elements] of Object.entries(credential.namespaces)) {
      const encoded: CborValue = {}
      for (const [element, value] of Object.entries(elements)) {
        encoded[element] = claim(display, [namespace, element], value)
      }
      namespaces[namespace] = encoded
    }

    return { ...common, mdoc: { documentId: id, docType: credential.doctype, namespaces } }
  }

  return {
    ...common,
    sdjwt: { documentId: id, vct: credential.vct, claims: sdJwtClaims(credential.claims, display, []) },
  }
}

/**
 * The matcher keys claims by their path joined with `.` — namespace and element for mdoc, the full
 * JSON path for SD-JWT.
 */
function sdJwtClaims(claims: SdJwtClaims, display: DcApiCredentialDisplay, path: string[]): CborValue {
  const result: CborValue = {}

  for (const [key, value] of Object.entries(claims)) {
    const claimPath = [...path, key]

    if (value && !Array.isArray(value) && typeof value === 'object') {
      Object.assign(result, sdJwtClaims(value, display, claimPath))
    } else {
      result[claimPath.join('.')] = claim(display, claimPath, value)
    }
  }

  return result
}

function claim(
  display: DcApiCredentialDisplay,
  path: string[],
  value: string | number | boolean | SdJwtClaims[] | null | undefined
): CborValue {
  const displayName = display.claims?.find((claim) => claim.path.join('.') === path.join('.'))?.displayName
  const rendered = renderValue(value)

  // Value matching is on the raw value; the matcher itself skips long values (portraits and the
  // like) so they never end up in a DCQL comparison.
  return [displayName ?? (path[path.length - 1] as string), rendered, rendered.length < 128 ? rendered : '']
}

function renderValue(value: string | number | boolean | SdJwtClaims[] | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return JSON.stringify(value)

  return String(value)
}

function decodeIcon(iconDataUrl: DcApiCredentialDisplay['iconDataUrl']): Uint8Array {
  if (!iconDataUrl) return new Uint8Array(0)

  return decodeBase64(iconDataUrl.slice(iconDataUrl.indexOf(',') + 1))
}

/**
 * The matcher builds picker entry ids as `<combination> <protocol> <documentId>`
 * (`Combination::addToCredmanPicker`). Document ids can contain spaces, the first two fields cannot.
 */
export function parseMultipazEntryId(entryId: string, protocols: DcApiProtocol[]) {
  const [, protocol, ...rest] = entryId.split(' ')
  if (!protocol || rest.length === 0) {
    throw new Error(`Unexpected selected entry id '${entryId}' for the multipaz matcher`)
  }

  return {
    credentialId: rest.join(' '),
    // The entry names the protocol it matched, not its position, so map it back onto the request.
    // `-1` when the matcher answers with a protocol the request does not contain.
    requestIndex: protocols.findIndex((requested) => requested === protocol),
  }
}
