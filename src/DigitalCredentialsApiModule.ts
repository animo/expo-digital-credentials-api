import { NativeModule, requireNativeModule } from 'expo'
import { Platform } from 'react-native'
import type { DigitalCredentialsApiModuleEvents } from './DigitalCredentialsApi.types'

declare class DigitalCredentialsApiModule extends NativeModule<DigitalCredentialsApiModuleEvents> {
  registerCredentialsRaw(
    credentialBytesBase64: string,
    matcherBytesBase64: string,
    protocol?: string,
    type?: string,
    registerCompatType?: boolean
  ): Promise<void>
  registerCreationOptionsRaw(
    creationOptionsBytesBase64: string,
    matcherBytesBase64: string,
    type?: string,
    id?: string,
    intentAction?: string
  ): Promise<void>
  getRequest(): string | null
  getCreateRequest(): string | null
  setAllowedApps(allowedAppsJson?: string | null): void
  sendResponse(response: string): void
  sendErrorResponse(errorMessage: string): void
  sendCreateResponse(response: string, type?: string, newEntryId?: string | null): void
  sendCreateErrorResponse(errorMessage: string): void
  isGetCredentialActivity(): boolean
  isCreateCredentialActivity(): boolean
}

// This call loads the native module object from the JSI.
export default Platform.OS === 'android'
  ? requireNativeModule<DigitalCredentialsApiModule>('DigitalCredentialsApi')
  : undefined
