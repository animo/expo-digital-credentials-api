import { type DcApiCredential, type DcApiMatcher, type DcApiProtocol, dcApiProtocols } from '../types'
import { encodeBase64 } from '../util'
import { encodeCredmanCredentials, parseCredmanEntryId } from './credman'
import { encodeMultipazCredentials, parseMultipazEntryId } from './multipaz'

export const defaultMatcher: DcApiMatcher = 'multipaz'

/**
 * The protocols each matcher can answer. The CMWallet and Ubique matchers only look at OpenID4VP
 * requests, so registering their credentials for `org-iso-mdoc` would never match anything.
 */
export const matcherProtocols: Record<DcApiMatcher, DcApiProtocol[]> = {
  multipaz: [...dcApiProtocols],
  cmwallet: ['openid4vp'],
  ubique: ['openid4vp'],
}

export function encodeCredentialsBase64(
  matcher: DcApiMatcher,
  credentials: DcApiCredential[],
  { protocols, debug }: { protocols: DcApiProtocol[]; debug?: boolean }
): string {
  const unsupported = protocols.filter((protocol) => !matcherProtocols[matcher].includes(protocol))
  if (unsupported.length > 0) {
    throw new Error(
      `The '${matcher}' matcher cannot answer ${unsupported.join(', ')}. It supports ${matcherProtocols[matcher].join(', ')}.`
    )
  }

  return encodeBase64(
    matcher === 'multipaz'
      ? encodeMultipazCredentials(credentials, protocols)
      : encodeCredmanCredentials(credentials, { debug })
  )
}

/**
 * Resolve the picker entry the user tapped. Each matcher encodes it differently, so the request
 * carries the matcher that produced it.
 *
 * `requestIndex` is in the verifier's index space — the requests as the matcher saw them, unknown
 * protocols included — and is `-1` when it cannot be resolved at all.
 */
export function parseSelectedEntry(matcher: DcApiMatcher, entryId: string, protocols: DcApiProtocol[]) {
  return matcher === 'multipaz' ? parseMultipazEntryId(entryId, protocols) : parseCredmanEntryId(entryId)
}
