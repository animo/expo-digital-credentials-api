import { parseSelection } from './matchers'
import { getNativeModule } from './nativeModule'
import {
  type AndroidDcApiRequest,
  type AndroidDcApiSelection,
  type DcApiMatcher,
  type DcApiProtocolRequest,
  type DcApiRequest,
  type DcApiResponseOptions,
  type IosDcApiRequest,
  type IosPresentmentRequest,
  type IosReaderAuthentication,
  type IsoMdocProtocolRequest,
  dcApiProtocols,
} from './types'

/**
 * The request as the native layer hands it over, before the actions are attached.
 *
 * The two platforms carry different things because they know different things at this point:
 * Android gets the protocol requests with the picker result, iOS only what the OS parsed out of a
 * request it has not released yet.
 */
type NativeRequest =
  | {
      platform: 'android'
      /** Null when the caller is a native app rather than a website. */
      origin: string | null
      callingPackage: string
      /**
       * Every request the verifier sent, in its order — including protocols this package does not
       * know, so the indices still line up with what the matcher saw.
       */
      requests: Array<{ protocol: string; data: unknown }>
      /**
       * Matcher-specific, see {@link parseSelection}: one entry, or one per slot of a picked set.
       * Null when the request did not come from the credential picker, which only the registry
       * action goes through.
       */
      selectedEntryIds: string[] | null
      matcher: DcApiMatcher
    }
  | {
      platform: 'ios'
      origin: string
      presentmentRequests: IosPresentmentRequest[]
      readerAuthentications: IosReaderAuthentication[]
    }

/**
 * Turn the native payload into the {@link DcApiRequest} the registered component receives.
 *
 * @internal
 */
export function parseRequest(raw: string | NativeRequest): DcApiRequest {
  const native: NativeRequest = typeof raw === 'string' ? JSON.parse(raw) : raw

  // A request is answered once. Past that the platform is done with it: a second answer reaches an
  // activity that is already finishing on Android, and a session that is gone on iOS.
  let answered = false

  const actions = {
    // The protocol and its response object are what the Digital Credentials API carries, so they go
    // to native as they are — neither platform re-wraps or adds to them.
    async respond({ protocol, data }: DcApiResponseOptions): Promise<void> {
      if (answered) throw new Error('The request was already answered')

      // Taken before the call, so a second `respond` while the first is in flight is refused too —
      // and given back if the first fails, so the wallet can still answer, or decline.
      answered = true
      try {
        await getNativeModule('respond').sendResponse(JSON.stringify({ protocol, data }))
      } catch (error) {
        answered = false
        throw error
      }
    },

    decline(reason?: string): void {
      if (answered) return
      answered = true

      getNativeModule('decline').sendErrorResponse(reason ?? 'The request was declined')
    },
  }

  if (native.platform === 'ios') {
    const presentmentRequests = native.presentmentRequests ?? []

    return {
      platform: 'ios',
      origin: native.origin,
      presentmentRequests,
      readerAuthentications: native.readerAuthentications ?? [],

      async approve(): Promise<IsoMdocProtocolRequest[]> {
        return JSON.parse(await getNativeModule('approve').approveRequest())
      },

      ...actions,
    } satisfies IosDcApiRequest
  }

  // Protocols this package cannot represent are dropped, but only after the picked entry has been
  // resolved against the full list: the matcher indexed the verifier's requests, not ours.
  const supported = (native.requests ?? [])
    .map((request, index) => ({ request, index }))
    .filter((entry): entry is { request: DcApiProtocolRequest; index: number } =>
      (dcApiProtocols as readonly string[]).includes(entry.request.protocol)
    )

  return {
    platform: 'android',
    // Kept as an absent value, never as an empty string: see `AndroidDcApiRequest.origin`.
    origin: native.origin ?? undefined,
    callingPackage: native.callingPackage,
    requests: supported.map((entry) => entry.request),
    selection: parseAndroidSelection(native, supported),
    ...actions,
  } satisfies AndroidDcApiRequest
}

/**
 * Absent when nothing was picked — see `AndroidDcApiRequest.selection`.
 */
function parseAndroidSelection(
  native: Extract<NativeRequest, { platform: 'android' }>,
  supported: Array<{ index: number }>
): AndroidDcApiSelection | undefined {
  if (!native.selectedEntryIds?.length) return undefined

  const selected = parseSelection(
    native.matcher,
    native.selectedEntryIds,
    (native.requests ?? []).map((request) => request.protocol)
  )

  // The matcher answers in the verifier's index space; the wallet gets ours. A request that was
  // dropped is not one the wallet can answer, so it is no candidate either.
  const candidateRequestIndexes = selected.requestIndexes.flatMap((verifierIndex) => {
    const index = supported.findIndex((entry) => entry.index === verifierIndex)
    return index === -1 ? [] : [index]
  })

  return {
    credentialIds: selected.credentialIds,
    requestIndex: candidateRequestIndexes.length === 1 ? candidateRequestIndexes[0] : undefined,
    candidateRequestIndexes,
  }
}
