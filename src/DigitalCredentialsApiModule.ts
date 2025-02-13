import { NativeModule, requireNativeModule } from 'expo'

import type { DigitalCredentialsApiModuleEvents } from './DigitalCredentialsApi.types'

declare class DigitalCredentialsApiModule extends NativeModule<DigitalCredentialsApiModuleEvents> {
  registerCredentials(credentialBytes: string): Promise<void>
}

// This call loads the native module object from the JSI.
export default requireNativeModule<DigitalCredentialsApiModule>('DigitalCredentialsApi')
