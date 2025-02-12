import { type ConfigPlugin, withAndroidManifest } from '@expo/config-plugins'
import type { ManifestIntentFilter } from '@expo/config-plugins/build/android/Manifest'

const GET_CREDENTIAL_ACTION = 'androidx.credentials.registry.provider.action.GET_CREDENTIAL'
const GET_CREDENTIALS_ACTION = 'androidx.identitycredentials.action.GET_CREDENTIALS'

const hasAction = (intentFilter: ManifestIntentFilter, actionName: string) =>
  intentFilter.action?.find((action) => action.$['android:name'] === actionName) !== undefined

const addAction = (intentFilter: ManifestIntentFilter, actionName: string) =>
  intentFilter.action?.push({
    $: {
      'android:name': actionName,
    },
  })

const withDigitalCredentialsApiAndroidManifest: ConfigPlugin = (config) =>
  withAndroidManifest(config, (pluginConfig) => {
    const androidManifest = pluginConfig.modResults.manifest

    const application = androidManifest.application?.find(
      (application) => application.$['android:name'] === '.MainApplication'
    )
    if (!application) {
      throw new Error('Unable to update <application /> MainApplication in AndroidManifest.xml as it was not found')
    }

    const activity = application.activity?.find((activity) => activity.$['android:name'] === '.MainActivity')
    if (!activity) {
      throw new Error(
        'Unable to update <activity /> MainActivity in <application /> MainApplication in AndroidManifest.xml as it was not found'
      )
    }

    if (!activity['intent-filter']) {
      activity['intent-filter'] = [
        {
          action: [],
        },
      ]
    }
    const [intentFilter] = activity['intent-filter']

    if (!hasAction(intentFilter, GET_CREDENTIALS_ACTION)) {
      addAction(intentFilter, GET_CREDENTIALS_ACTION)
    }

    if (!hasAction(intentFilter, GET_CREDENTIAL_ACTION)) {
      addAction(intentFilter, GET_CREDENTIAL_ACTION)
    }

    return pluginConfig
  })

export const withAndroidDigitalCredentialsApi: ConfigPlugin = (config) => {
  const newConfig = withDigitalCredentialsApiAndroidManifest(config)

  return newConfig
}
