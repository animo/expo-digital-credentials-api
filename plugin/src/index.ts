import { type ConfigPlugin, createRunOncePlugin, withPlugins } from '@expo/config-plugins'

import { withAndroidDigitalCredentialsApi } from './withAndroidDigitalCredentialsApi'

const withDigitalCredentialsApi: ConfigPlugin = (config) => {
  return withPlugins(config, [withAndroidDigitalCredentialsApi])
}

export default createRunOncePlugin(withDigitalCredentialsApi, '@animo-id/expo-digital-credentials-api')
