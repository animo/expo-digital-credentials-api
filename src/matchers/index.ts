import { type DcApiCredential, type DcApiMatcher, type DcApiProtocol, dcApiProtocols } from '../types'
import { encodeBase64 } from '../util'
import { encodeCredmanCredentials, parseCredmanSelection } from './credman'
import { encodeMultipazCredentials, parseMultipazSelection } from './multipaz'

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

  // Issuer identifiers only narrow what a verifier's `trusted_authorities` matches, which the other
  // matchers ignore anyway. A reader gate they would drop silently, offering the credential to every
  // reader instead of the ones it was meant for.
  const gated = credentials.find((credential) => credential.android?.supportedAuthorityKeyIdentifiers?.length)
  if (matcher !== 'multipaz' && gated) {
    throw new Error(
      `The '${matcher}' matcher cannot gate credential '${gated.id}' on its reader. Only 'multipaz' supports android.supportedAuthorityKeyIdentifiers.`
    )
  }

  return encodeBase64(
    matcher === 'multipaz'
      ? encodeMultipazCredentials(credentials, protocols)
      : encodeCredmanCredentials(credentials, { debug })
  )
}

/**
 * What the user picked, in the verifier's index space: the requests as the matcher saw them, unknown
 * protocols included.
 */
export interface ParsedSelection {
  /** The picked credentials, one per slot of the picked set. */
  credentialIds: string[]

  /** Every request the pick may have been matched against, in order. Exact when there is one. */
  requestIndexes: number[]
}

/**
 * Resolve the picker entries the user chose — one, or one per slot of a set. Each matcher encodes
 * them differently, so the request carries the matcher that produced them.
 */
export function parseSelection(matcher: DcApiMatcher, entryIds: string[], protocols: string[]): ParsedSelection {
  return matcher === 'multipaz' ? parseMultipazSelection(entryIds, protocols) : parseCredmanSelection(entryIds)
}
