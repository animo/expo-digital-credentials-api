import fs from 'node:fs'
import path from 'node:path'
import plist from '@expo/plist'
import type { ExpoConfig } from 'expo/config'
import { type ConfigPlugin, withDangerousMod } from 'expo/config-plugins'
import { getBundleRoot } from '../entry'
import {
  type DigitalCredentialsApiPluginOptions,
  extensionTargetName,
  getAppGroup,
  getExtensionBundleIdentifier,
  getKeychainAccessGroup,
} from '../types'

/**
 * Swift sources vendored by this package, copied into the generated Xcode project. Only what cannot
 * live in the pod is here: the ExtensionKit principal class and the scene it hosts React Native in.
 * Everything JS talks to is in the pod, which the extension target autolinks like the app does.
 */
export const allExtensionFiles = [
  'IdentityDocumentProviderExtension.swift',
  'DocumentRequestSession.swift',
  'DigitalCredentialsRequestView.swift',
  'ExtensionFonts.swift',
  'Info.plist',
]

export const withExtensionFiles: ConfigPlugin<DigitalCredentialsApiPluginOptions> = (config, options) =>
  withDangerousMod(config, [
    'ios',
    (config) => {
      const bundleIdentifier = config.ios?.bundleIdentifier as string
      const projectRoot = config.modRequest.platformProjectRoot
      const targetDirectory = path.join(projectRoot, extensionTargetName)

      fs.mkdirSync(targetDirectory, { recursive: true })

      const packageIosDirectory = path.join(__dirname, '..', '..', '..', 'ios')
      // `{{BUNDLE_ROOT}}` is what the extension asks Metro for in debug builds.
      const substitutions = {
        '{{BUNDLE_ROOT}}': getBundleRoot(config.modRequest.projectRoot, options),
        '{{BACKGROUND_COLOR_LIGHT}}': backgroundColor(options, 'light'),
        '{{BACKGROUND_COLOR_DARK}}': backgroundColor(options, 'dark'),
      }

      for (const file of allExtensionFiles) {
        copyTemplate(path.join(packageIosDirectory, 'DocumentProvider', file), targetDirectory, file, substitutions)
      }

      // A prebuild over an existing `ios/` leaves whatever an older version of this package vendored
      // in place. A stale source still compiles into the extension, which is how a file that was
      // renamed goes on running.
      for (const file of fs.readdirSync(targetDirectory)) {
        if (file.endsWith('.swift') && !allExtensionFiles.includes(file)) {
          fs.rmSync(path.join(targetDirectory, file))
        }
      }

      // The extension reads both of these from its own Info.plist: the app group it shares with the
      // app, and the fonts it registers out of the app's bundle at launch.
      const infoPlistPath = path.join(targetDirectory, 'Info.plist')
      const { ANIMO_DC_API_FONTS: _fonts, ...parsed } = plist.parse(fs.readFileSync(infoPlistPath, 'utf8')) as Record<
        string,
        unknown
      >

      const fonts = options.ios?.fonts ?? []
      const infoPlist = {
        ...parsed,
        ANIMO_DC_API_APP_GROUP: getAppGroup(bundleIdentifier, options),
        // Dropped rather than emptied when nothing is configured, so the extension can tell "no
        // fonts wanted" from "fonts wanted and none found".
        ...(fonts.length > 0 ? { ANIMO_DC_API_FONTS: fonts } : {}),
        // The app's `userInterfaceStyle` reaches its own Info.plist only, and the extension is a
        // separate bundle: an app pinned to light would otherwise get a request UI that follows the
        // device, down to the sheet's own title bar turning dark around a light screen.
        ...userInterfaceStyle(config, options),
      }

      fs.writeFileSync(infoPlistPath, plist.build(infoPlist))

      fs.writeFileSync(
        path.join(targetDirectory, `${extensionTargetName}.entitlements`),
        plist.build({
          'com.apple.developer.identity-document-services.document-provider.mobile-document-types':
            options.ios?.documentTypes ?? [],
          'com.apple.security.application-groups': [getAppGroup(bundleIdentifier, options)],
          'keychain-access-groups': [`$(AppIdentifierPrefix)${getKeychainAccessGroup(bundleIdentifier, options)}`],
        })
      )

      return config
    },
  ])

/**
 * `UIUserInterfaceStyle` for the extension: what `ios.userInterfaceStyle` asked for, or the app's
 * own. Absent for `automatic`, which is what the OS does without the key — and the only way the
 * request UI sees the device's appearance, since this key is also what `Appearance` reports from.
 */
function userInterfaceStyle(config: ExpoConfig, options: DigitalCredentialsApiPluginOptions) {
  const style = options.ios?.userInterfaceStyle ?? config.ios?.userInterfaceStyle ?? config.userInterfaceStyle

  if (style === 'light') return { UIUserInterfaceStyle: 'Light' }
  if (style === 'dark') return { UIUserInterfaceStyle: 'Dark' }

  return {}
}

/**
 * The background for one appearance, as a hex string, or empty for the system background.
 *
 * Validated here so a typo fails the prebuild instead of silently falling back at runtime. A single
 * colour is used for both appearances, which is what an app pinned to one of them wants.
 */
export function backgroundColor(options: DigitalCredentialsApiPluginOptions, scheme: 'light' | 'dark') {
  const configured = options.ios?.backgroundColor
  if (configured === undefined) return ''

  const color = typeof configured === 'string' ? configured : configured[scheme]
  if (color === undefined) return ''

  if (!/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) {
    throw new Error(`Invalid ios.backgroundColor '${color}'. Expected '#RRGGBB' or '#RRGGBBAA'.`)
  }

  return color
}

function copyTemplate(source: string, targetDirectory: string, file: string, substitutions: Record<string, string>) {
  let contents = fs.readFileSync(source, 'utf8')
  for (const [placeholder, value] of Object.entries(substitutions)) {
    contents = contents.split(placeholder).join(value)
  }

  fs.writeFileSync(path.join(targetDirectory, file), contents)
}

export function getExtensionEntitlementsPath() {
  return `${extensionTargetName}/${extensionTargetName}.entitlements`
}

export { getExtensionBundleIdentifier }
