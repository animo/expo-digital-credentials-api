import type {
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

export function sendResponse(options: SendResponseOptions) {
  Module.sendResponse(options.response)
}

export function sendErrorResponse(options: SendErrorResponseOptions) {
  Module.sendErrorResponse(options.errorMessage)
}
