import type { DcApiCredential, DcApiCredentialDisplay, DcApiProtocol, SdJwtClaims } from '../types'
import { decodeBase64 } from '../util'
import { type CborValue, encodeCbor } from './cbor'
import type { ParsedSelection } from './index'

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
 *                "issuerIdentifiers": [bstr], "readerIdentifiers": [bstr],   ; optional
 *                "namespaces": { ns: { element: [display, value, matchValue] } } },
 *     "sdjwt": { "documentId": tstr, "vct": tstr,
 *                "issuerIdentifiers": [bstr], "readerIdentifiers": [bstr],   ; optional
 *                "claims": { "a.b.c": [display, value, matchValue] } }
 *   }]
 * }
 * ```
 *
 * `title`, `subtitle` and `bitmap` are read unconditionally, so they are always written. The
 * identifiers are only written when there are any, which is also what tells the matcher a credential
 * is not gated on its reader.
 */
export function encodeMultipazCredentials(credentials: DcApiCredential[], protocols: DcApiProtocol[]): Uint8Array {
  return encodeCbor({
    protocols,
    credentials: credentials.map(encodeCredential),
  })
}

function encodeCredential({ id, display, credential, android }: DcApiCredential): CborValue {
  const common = {
    title: display.title,
    subtitle: display.subtitle ?? '',
    bitmap: decodeIcon(display.iconDataUrl),
  }

  const identifiers: CborValue = {}
  if (android?.issuerAuthorityKeyIdentifiers?.length) {
    identifiers.issuerIdentifiers = android.issuerAuthorityKeyIdentifiers.map((value) =>
      decodeIdentifier(value, 'issuerAuthorityKeyIdentifiers', id)
    )
  }
  if (android?.supportedAuthorityKeyIdentifiers?.length) {
    identifiers.readerIdentifiers = android.supportedAuthorityKeyIdentifiers.map((value) =>
      decodeIdentifier(value, 'supportedAuthorityKeyIdentifiers', id)
    )
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

    return { ...common, mdoc: { documentId: id, docType: credential.doctype, ...identifiers, namespaces } }
  }

  return {
    ...common,
    sdjwt: {
      documentId: id,
      vct: credential.vct,
      ...identifiers,
      claims: sdJwtClaims(credential.claims, display, []),
    },
  }
}

/**
 * The matcher keys claims by their path joined with `.` — namespace and element for mdoc, the full
 * JSON path for SD-JWT.
 *
 * A nested object is registered as a claim of its own as well as flattened, so a request asking for
 * `address` matches the same credential a request asking for `address.city` does, and the picker
 * has something to show for it either way.
 */
function sdJwtClaims(claims: SdJwtClaims, display: DcApiCredentialDisplay, path: string[]): CborValue {
  const result: CborValue = {}

  for (const [key, value] of Object.entries(claims)) {
    const claimPath = [...path, key]
    result[claimPath.join('.')] = claim(display, claimPath, value)

    if (isNestedObject(value)) {
      Object.assign(result, sdJwtClaims(value, display, claimPath))
    }
  }

  return result
}

/**
 * One claim, as `[displayName, value, matchValue]`.
 *
 * The last two are the same string unless the wallet passes a `displayValue`: the matcher draws
 * `value` in the picker and compares `matchValue` against the `values` of a DCQL claim, so a claim
 * can be made to read well without changing what the credential matches. Long values — a portrait
 * handed over as base64, say — are left out of matching, where a DCQL value never is that long.
 */
function claim(display: DcApiCredentialDisplay, path: string[], value: SdJwtClaims[string]): CborValue {
  const claimDisplay = display.claims?.find((claim) => claim.path.join('.') === path.join('.'))
  const registered = registeredValue(value)

  return [
    claimDisplay?.displayName ?? (path[path.length - 1] as string),
    claimDisplay?.displayValue ?? registered,
    registered.length < 128 ? registered : '',
  ]
}

/**
 * Every member of the database is a CBOR text string — the matcher reads all three with
 * `asTstr()->value()` (`CredentialDatabase.cpp`) — so a value that is not one is written as one.
 * The request side does the same before comparing, in `dcql.cpp`: a DCQL `values` member becomes
 * `"true"`/`"false"` for a boolean and `std::to_string` for a number, so `true` and `"true"` are
 * the same query to this matcher, and there is nothing to tell apart here either.
 *
 * The rest carries no value at all: `null`, and the objects and arrays a claim can hold, which
 * match on their path.
 */
function registeredValue(value: SdJwtClaims[string]): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  return ''
}

/**
 * Whether the value holds claims of its own, which are registered as claims in their own right.
 */
function isNestedObject(value: SdJwtClaims[string]): value is SdJwtClaims {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Base64, as iOS takes the same identifiers. A base64url value copied from a `trusted_authorities`
 * entry is refused rather than guessed at.
 */
function decodeIdentifier(value: string, option: string, credentialId: string): Uint8Array {
  try {
    return decodeBase64(value)
  } catch {
    throw new TypeError(`'android.${option}' holds '${value}', which is not base64, for credential '${credentialId}'`)
  }
}

function decodeIcon(iconDataUrl: DcApiCredentialDisplay['iconDataUrl']): Uint8Array {
  if (!iconDataUrl) return new Uint8Array(0)

  return decodeBase64(iconDataUrl.slice(iconDataUrl.indexOf(',') + 1))
}

/**
 * The matcher builds one picker entry per credential in a combination, with ids of the form
 * `<combination> <protocol> <documentId>` (`Combination::addToCredmanPicker`), so a picked set
 * arrives as one id per slot. Document ids can contain spaces, the first two fields cannot.
 *
 * The entries name a protocol, not a request. The matcher walks the requests in order, adds the
 * combinations of the first one the registered credentials can satisfy and stops (`matcher.cpp`),
 * but it only hands the protocol on: the set id is `<combination> <protocol>` and the entry metadata
 * is left empty. So every request with that protocol is a candidate. Of those, the one the matcher
 * answered is the first the picked credentials satisfy, since the ones before it were not
 * satisfiable at all.
 */
export function parseMultipazSelection(entryIds: string[], protocols: string[]): ParsedSelection {
  const entries = entryIds.map((entryId) => {
    const [, protocol, ...rest] = entryId.split(' ')
    if (!protocol || rest.length === 0) {
      throw new Error(`Unexpected selected entry id '${entryId}' for the multipaz matcher`)
    }

    return { protocol, credentialId: rest.join(' ') }
  })

  // The entries of a set all come from one combination, so they name the same protocol.
  const protocol = entries[0]?.protocol

  return {
    credentialIds: entries.map((entry) => entry.credentialId),
    requestIndexes: protocols.flatMap((requested, index) => (requested === protocol ? [index] : [])),
  }
}
