import { EventEmitter, useEvent } from 'expo'
import type {
  DigitalCredentialsApiModuleEvents,
  OnRequestEventPayload,
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

export function getRequest() {
  return Module.getRequest()
}

export function sendResponse(options: SendResponseOptions) {
  Module.sendResponse(options.response)
}

export function sendErrorResponse(options: SendErrorResponseOptions) {
  Module.sendErrorResponse(options.errorType, options.errorMessage)
}

// const eventEmitter = new EventEmitter<DigitalCredentialsApiModuleEvents>(Module)
// export function onRequestListener(
//   listener: (params: OnRequestEventPayload) => void
// ): ReturnType<typeof Module.addListener> {
//   return eventEmitter.addListener('onRequest', listener)
// }

// export function useRequestListener() {
//   return useEvent(Module, 'onRequest')
// }
