import type { RegisterCredentialsOptions } from './DigitalCredentialsApi.types'
import Module from './DigitalCredentialsApiModule'
import { encodeCredentials } from './encodeCredentials'

export async function registerCredentials(options: RegisterCredentialsOptions): Promise<void> {
  const credentialBytes = encodeCredentials(options)

  await Module.registerCredentials(credentialBytes)
}
