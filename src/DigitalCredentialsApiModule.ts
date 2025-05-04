import { NativeModule, requireNativeModule } from 'expo'

import { Platform } from 'react-native'
import type { DigitalCredentialsApiModuleEvents } from './DigitalCredentialsApi.types'

export type DigitalCredentialsApiMatcher = 'cmwallet' | 'ubique'

declare class DigitalCredentialsApiModule extends NativeModule<DigitalCredentialsApiModuleEvents> {
  registerCredentials(credentialBytesBase64: string, matcher: DigitalCredentialsApiMatcher): Promise<void>
  getRequest(): string | null
  sendResponse(response: string): void
  sendErrorResponse(errorMessage: string): void
  isGetCredentialActivity(): boolean
}

// This call loads the native module object from the JSI.
export default Platform.OS === 'android'
  ? requireNativeModule<DigitalCredentialsApiModule>('DigitalCredentialsApi')
  : undefined
