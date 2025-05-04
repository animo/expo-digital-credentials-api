import type {
  RegisterCredentialsOptions,
  SendErrorResponseOptions,
  SendResponseOptions,
} from './DigitalCredentialsApi.types'
import Module from './DigitalCredentialsApiModule'
import { getEncodedCredentialsBase64 } from './encodeCredentials'
import { ensureAndroid } from './util'

export async function registerCredentials(options: RegisterCredentialsOptions): Promise<void> {
  ensureAndroid()
  const credentialBytesBase64 = getEncodedCredentialsBase64(options.credentials)

  await Module?.registerCredentials(credentialBytesBase64, options.matcher ?? 'cmwallet')
}

export function sendResponse(options: SendResponseOptions) {
  ensureAndroid()

  Module?.sendResponse(options.response)
}

export function sendErrorResponse(options: SendErrorResponseOptions) {
  ensureAndroid()

  Module?.sendErrorResponse(options.errorMessage)
}

export function isGetCredentialActivity(): boolean {
  ensureAndroid()

  return Module?.isGetCredentialActivity() as boolean
}
