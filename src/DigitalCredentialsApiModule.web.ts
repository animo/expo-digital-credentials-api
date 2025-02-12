import { registerWebModule, NativeModule } from 'expo';

import { DigitalCredentialsApiModuleEvents } from './DigitalCredentialsApi.types';

class DigitalCredentialsApiModule extends NativeModule<DigitalCredentialsApiModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(DigitalCredentialsApiModule);
