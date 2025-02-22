import { type ConfigPlugin, withProjectBuildGradle } from '@expo/config-plugins'

// TODO: i think there might be a better way to configure this
const withCustomAppBuildGradle: ConfigPlugin = (config) => {
  return withProjectBuildGradle(config, async (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      `'org.jetbrains.kotlin:kotlin-gradle-plugin'`,
      `"org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion"`
    )

    return config
  })
}

export const withAndroidDigitalCredentialsApi: ConfigPlugin = (config) => withCustomAppBuildGradle(config)
