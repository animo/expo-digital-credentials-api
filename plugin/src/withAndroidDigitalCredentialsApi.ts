import { AndroidConfig, type ConfigPlugin, withAndroidManifest, withProjectBuildGradle } from '@expo/config-plugins'
import type { ManifestIntentFilter } from '@expo/config-plugins/build/android/Manifest'

const GET_CREDENTIAL_ACTION = 'androidx.credentials.registry.provider.action.GET_CREDENTIAL'
const GET_CREDENTIALS_ACTION = 'androidx.identitycredentials.action.GET_CREDENTIALS'
const DEFAULT_INTENT_CATEGORY = 'android.intent.category.DEFAULT'

const hasAction = (intentFilter: ManifestIntentFilter, actionName: string) =>
  intentFilter.action?.find((action) => action.$['android:name'] === actionName) !== undefined

const hasCategory = (intentFilter: ManifestIntentFilter, categoryName: string) =>
  intentFilter.category?.find((category) => category.$['android:name'] === categoryName) !== undefined

const addAction = (intentFilter: ManifestIntentFilter, actionName: string) =>
  intentFilter.action?.push({
    $: {
      'android:name': actionName,
    },
  })

const addCategory = (intentFilter: ManifestIntentFilter, categoryName: string) =>
  intentFilter.category?.push({
    $: {
      'android:name': categoryName,
    },
  })

const withDigitalCredentialsApiAndroidManifest: ConfigPlugin = (config) =>
  withAndroidManifest(config, (pluginConfig) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(pluginConfig.modResults)

    if (!activity['intent-filter']) activity['intent-filter'] = []
    let intentFilter = activity['intent-filter'].find(
      (intentFilter) =>
        hasAction(intentFilter, GET_CREDENTIALS_ACTION) || hasAction(intentFilter, GET_CREDENTIAL_ACTION)
    )

    if (!intentFilter) {
      intentFilter = {}

      activity['intent-filter'].push(intentFilter)
    }

    if (!intentFilter.action) intentFilter.action = []
    if (!intentFilter.category) intentFilter.category = []

    if (!hasAction(intentFilter, GET_CREDENTIALS_ACTION)) {
      addAction(intentFilter, GET_CREDENTIALS_ACTION)
    }

    if (!hasAction(intentFilter, GET_CREDENTIAL_ACTION)) {
      addAction(intentFilter, GET_CREDENTIAL_ACTION)
    }

    if (!hasCategory(intentFilter, DEFAULT_INTENT_CATEGORY)) {
      addCategory(intentFilter, DEFAULT_INTENT_CATEGORY)
    }

    // TODO: make configurable
    const newAttributes = {
      'android:launchMode': 'singleTask',
    }
    activity.$ = { ...activity.$, ...newAttributes }

    return pluginConfig
  })

const withCustomAppBuildGradle: ConfigPlugin = (config) => {
  return withProjectBuildGradle(config, async (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      `'org.jetbrains.kotlin:kotlin-gradle-plugin'`,
      `"org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion"`
    )

    return config
  })
}

export const withAndroidDigitalCredentialsApi: ConfigPlugin = (config) => {
  let newConfig = withDigitalCredentialsApiAndroidManifest(config)
  newConfig = withCustomAppBuildGradle(newConfig)

  return newConfig
}
