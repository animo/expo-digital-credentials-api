import { registerCreationOptions as registerCreationOptionsRaw } from '@animo-id/expo-digital-credentials-api'
import {
  encodeIssuanceCreationOptions,
  type IssuanceDisplayData,
  type IssuanceRegistryOptions,
} from './encodeIssuance'
import { loadMatcherBytes } from './matcherBytes'
import type { IssuanceCreationOptionsBytes, IssuanceCreationOptionsJson, IssuanceDisplayEntry } from './schema'

export type {
  IssuanceCreationOptionsBytes,
  IssuanceCreationOptionsJson,
  IssuanceDisplayEntry,
  IssuanceDisplayData,
  IssuanceRegistryOptions,
}
export { encodeIssuanceCreationOptions, loadMatcherBytes }

export interface RegisterCreationOptionsOptions {
  creationOptions: Uint8Array
  matcherBytes?: Uint8Array
  type?: string
  id?: string
  intentAction?: string
}

export async function registerCreationOptions(options: RegisterCreationOptionsOptions): Promise<void> {
  const matcherBytes = options.matcherBytes ?? (await loadMatcherBytes())

  return registerCreationOptionsRaw({
    creationOptions: options.creationOptions,
    matcherBytes,
    type: options.type,
    id: options.id ?? 'openid4vci',
    intentAction: options.intentAction ?? '',
  })
}
