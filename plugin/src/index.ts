import path from 'node:path'
import { type ConfigPlugin, createRunOncePlugin, withPlugins } from 'expo/config-plugins'
import { withAndroidDcApiBundle } from './android/withDcApiBundle'
import { withAppEntitlements } from './ios/withEntitlements'
import { withExtensionFiles } from './ios/withExtensionFiles'
import { withExtensionPodfile } from './ios/withExtensionPodfile'
import { withExtensionTarget } from './ios/withExtensionTarget'
import { packageRoot } from './packageRoot'
import {
  type DigitalCredentialsApiPluginOptions,
  extensionTargetName,
  getAppGroup,
  getExtensionBundleIdentifier,
  getKeychainAccessGroup,
} from './types'

const pkg = require(path.join(packageRoot, 'package.json'))

/**
 * Tell EAS Build to provision a profile for the extension target. Without this the build fails on
 * the missing provisioning profile for the appex bundle identifier.
 */
const withEasAppExtension: ConfigPlugin<DigitalCredentialsApiPluginOptions> = (config, options) => {
  const bundleIdentifier = config.ios?.bundleIdentifier as string
  const extensionBundleIdentifier = getExtensionBundleIdentifier(bundleIdentifier, options)

  const appExtensions = config.extra?.eas?.build?.experimental?.ios?.appExtensions ?? []
  if (
    appExtensions.some(
      (extension: { bundleIdentifier: string }) => extension.bundleIdentifier === extensionBundleIdentifier
    )
  ) {
    return config
  }

  return {
    ...config,
    extra: {
      ...config.extra,
      eas: {
        ...config.extra?.eas,
        build: {
          ...config.extra?.eas?.build,
          experimental: {
            ...config.extra?.eas?.build?.experimental,
            ios: {
              ...config.extra?.eas?.build?.experimental?.ios,
              appExtensions: [
                ...appExtensions,
                {
                  targetName: extensionTargetName,
                  bundleIdentifier: extensionBundleIdentifier,
                  entitlements: {
                    'com.apple.security.application-groups': [getAppGroup(bundleIdentifier, options)],
                    'keychain-access-groups': [
                      `$(AppIdentifierPrefix)${getKeychainAccessGroup(bundleIdentifier, options)}`,
                    ],
                    'com.apple.developer.identity-document-services.document-provider.mobile-document-types':
                      options.ios?.documentTypes,
                  },
                },
              ],
            },
          },
        },
      },
    },
  }
}

/**
 * Configures the credential request UI on both platforms: an identity document provider extension
 * on iOS, and a separately bundled activity on Android. Both render the component registered by the
 * `entry` file.
 *
 * iOS is only configured when `ios.documentTypes` is set, since the extension cannot be built
 * without the entitlement it goes into.
 */
const withDigitalCredentialsApi: ConfigPlugin<DigitalCredentialsApiPluginOptions | undefined> = (
  config,
  options = {}
) => {
  const withIos: Parameters<typeof withPlugins>[1] = options.ios?.documentTypes?.length
    ? [
        [withAppEntitlements, options],
        [withEasAppExtension, options],
        [withExtensionFiles, options],
        [withExtensionPodfile, options],
        [withExtensionTarget, options],
      ]
    : []

  return withPlugins(config, [...withIos, [withAndroidDcApiBundle, options]])
}

export default createRunOncePlugin(withDigitalCredentialsApi, pkg.name, pkg.version)
export type { DigitalCredentialsApiPluginOptions }
