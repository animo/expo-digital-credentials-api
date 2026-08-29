import { parseSelectedEntry } from './matchers'
import { getNativeModule } from './nativeModule'
import {
  type AndroidDcApiRequest,
  type DcApiMatcher,
  type DcApiProtocol,
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
       * Matcher-specific, see {@link parseSelectedEntry}. Null when the request did not come from
       * the credential picker, which only the registry action goes through.
       */
      selectedEntryId: string | null
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

  const actions = {
    // The protocol and its response object are what the Digital Credentials API carries, so they go
    // to native as they are — neither platform re-wraps or adds to them.
    async respond({ protocol, data }: DcApiResponseOptions): Promise<void> {
      await getNativeModule('respond').sendResponse(JSON.stringify({ protocol, data }))
    },

    decline(reason?: string): void {
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

  // Absent when nothing was picked — see `AndroidDcApiRequest.selectedCredentialId`.
  const selected = native.selectedEntryId
    ? parseSelectedEntry(
        native.matcher,
        native.selectedEntryId,
        (native.requests ?? []).map((request) => request.protocol as DcApiProtocol)
      )
    : undefined

  return {
    platform: 'android',
    // Kept as an absent value, never as an empty string: see `AndroidDcApiRequest.origin`.
    origin: native.origin ?? undefined,
    callingPackage: native.callingPackage,
    requests: supported.map((entry) => entry.request),
    selectedCredentialId: selected?.credentialId,
    // The matcher answers in the verifier's index space; the wallet gets ours.
    selectedRequestIndex: selected
      ? Math.max(
          supported.findIndex((entry) => entry.index === selected.requestIndex),
          0
        )
      : 0,
    ...actions,
  } satisfies AndroidDcApiRequest
}
