import type { CredentialItem } from './encodeCredentials'

export interface RegisterCredentialsOptions {
  credentials: CredentialItem[]
}

export interface SendResponseOptions {
  response: string
}

export interface SendErrorResponseOptions {
  errorType: string
  errorMessage: string
}

export type OnRequestEventPayload = {
  request: string
}

export type DigitalCredentialsApiModuleEvents = {
  onRequest: (params: OnRequestEventPayload) => void
}
