import type { RegisterCredentialsOptions } from './DigitalCredentialsApi.types'

export function encodeCredentials(options: RegisterCredentialsOptions): string {
  return JSON.stringify(options)
}
