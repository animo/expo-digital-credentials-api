import type {
  RegisterCreationOptionsOptions,
  RegisterCredentialsOptions,
  SetAllowedAppsOptions,
  SendCreateErrorResponseOptions,
  SendCreateResponseOptions,
  SendErrorResponseOptions,
  SendResponseOptions,
} from './DigitalCredentialsApi.types'
import Module from './DigitalCredentialsApiModule'
import { encodeBase64, ensureAndroid } from './util'

export async function registerCredentials(options: RegisterCredentialsOptions): Promise<void> {
  ensureAndroid()

  const credentialBytesBase64 = encodeBase64(options.credentialBytes)
  const matcherBytesBase64 = encodeBase64(options.matcherBytes)
  await Module?.registerCredentialsRaw(
    credentialBytesBase64,
    matcherBytesBase64,
    options.protocol,
    options.type,
    options.registerCompatType
  )
}

export async function registerCreationOptions(options: RegisterCreationOptionsOptions): Promise<void> {
  ensureAndroid()

  const creationOptionsBytesBase64 = encodeBase64(options.creationOptions)
  const matcherBytesBase64 = encodeBase64(options.matcherBytes)
  await Module?.registerCreationOptionsRaw(
    creationOptionsBytesBase64,
    matcherBytesBase64,
    options.type,
    options.id ?? 'openid4vci',
    options.intentAction ?? ''
  )
}

export function sendResponse(options: SendResponseOptions) {
  ensureAndroid()

  Module?.sendResponse(options.response)
}

export function sendErrorResponse(options: SendErrorResponseOptions) {
  ensureAndroid()

  Module?.sendErrorResponse(options.errorMessage)
}

export function sendCreateResponse(options: SendCreateResponseOptions) {
  ensureAndroid()

  Module?.sendCreateResponse(options.response, options.type, options.newEntryId ?? null)
}

export function sendCreateErrorResponse(options: SendCreateErrorResponseOptions) {
  ensureAndroid()

  Module?.sendCreateErrorResponse(options.errorMessage)
}

export function setAllowedApps(options: SetAllowedAppsOptions) {
  ensureAndroid()

  Module?.setAllowedApps(options.allowedAppsJson ?? null)
}

export function isGetCredentialActivity(): boolean {
  ensureAndroid()

  return Module?.isGetCredentialActivity() as boolean
}

export function isCreateCredentialActivity(): boolean {
  ensureAndroid()

  return Module?.isCreateCredentialActivity() as boolean
}
