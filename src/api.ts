import { useEvent } from 'expo'
import { useMemo } from 'react'
import type {
  DigitalCredentialsRequest,
  RegisterCredentialsOptions,
  SendErrorResponseOptions,
  SendResponseOptions,
} from './DigitalCredentialsApi.types'
import Module from './DigitalCredentialsApiModule'
import { getEncodedCredentialsBase64 } from './encodeCredentials'

export async function registerCredentials(options: RegisterCredentialsOptions): Promise<void> {
  const credentialBytesBase64 = getEncodedCredentialsBase64(options.credentials)

  await Module.registerCredentials(credentialBytesBase64)
}

/**
 * Get the DigitalCredentials request that was sent to this app using an intent.
 *
 * Note: Currently the matcher is bundled with this library and only supports the `openid4vp` protocol with `dcql_query`
 * and unsigned requests. Future versions of this library will support custom matchers, as well as other openid4vp features.
 */
export function getRequest(): DigitalCredentialsRequest | null {
  const request = Module.getRequest()
  if (request) return JSON.parse(request)
  return null
}

export function sendResponse(options: SendResponseOptions) {
  Module.sendResponse(options.response)
}

export function sendErrorResponse(options: SendErrorResponseOptions) {
  Module.sendErrorResponse(options.errorMessage)
}

export function onRequestListener(
  listener: (request: DigitalCredentialsRequest) => void
): ReturnType<typeof Module.addListener> {
  return Module.addListener('onRequest', ({ request }) => listener(JSON.parse(request)))
}

export function useRequestListener() {
  const event = useEvent(Module, 'onRequest')

  const request = useMemo(() => {
    if (!event?.request) return null
    return JSON.parse(event.request) as DigitalCredentialsRequest
  }, [event?.request])

  return request
}
