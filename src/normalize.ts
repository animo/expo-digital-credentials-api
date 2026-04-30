import type { DigitalCredentialsRequest } from './DigitalCredentialsApi.types'

export function normalizeGetRequest(raw: string): DigitalCredentialsRequest {
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid Digital Credentials API request payload')
  }
  return parsed as DigitalCredentialsRequest
}
