import type { IosSupportedDocumentType } from './documentTypes'

export type DigitalCredentialsApiPluginOptions = {
  /**
   * Bundle root of the credential request UI, relative to the project root, without the file
   * extension. Metro resolves the platform variants, so `dc-api/index` picks up
   * `dc-api/index.tsx`, `dc-api/index.ios.tsx` or `dc-api/index.android.tsx`.
   *
   * The file must register the component with `registerDcApiScreen()` from
   * `@animo-id/expo-digital-credentials-api/request-handler`.
   *
   * @default 'dc-api/index'
   */
  entry?: string

  ios?: {
    /**
     * The mobile document types the wallet can provide. These go into the
     * `com.apple.developer.identity-document-services.document-provider.mobile-document-types`
     * entitlement, which is what the OS matches registrations against: `registerCredentials` skips
     * credentials whose document type is not listed here, and `registerCredential` throws for one.
     *
     * Required to build the provider extension.
     */
    documentTypes?: IosSupportedDocumentType[]

    /**
     * App group shared by the app and the provider extension, written into the entitlements and the
     * Info.plist of both targets.
     *
     * The extension is a separate process with its own sandbox, so anything both halves have to read
     * — the wallet's credential database, above all — lives in this container. The package stores
     * nothing there itself; `getSharedContainerPath()` resolves the path in either process.
     *
     * @default `group.<ios bundle identifier>`
     */
    appGroup?: string

    /**
     * Keychain access group shared by the app and the provider extension.
     *
     * Defaults to the app's bundle identifier, which is also the implicit default group of keys the
     * app created before the extension existed — so existing keys stay reachable from the extension
     * without a migration.
     */
    keychainAccessGroup?: string

    /**
     * Suffix appended to the app's bundle identifier for the extension.
     *
     * @default 'DocumentProvider'
     */
    bundleIdSuffix?: string

    /**
     * Deployment target of the extension. IdentityDocumentServices requires iOS 26; the app's own
     * deployment target is left untouched so it stays installable on older iOS.
     *
     * @default '26.0'
     */
    deploymentTarget?: string

    /**
     * Appearance the request UI renders in.
     *
     * Defaults to the app's own `userInterfaceStyle`, since the request UI is the wallet's and
     * should not look like a different app. Set it to `automatic` when the app is pinned to one
     * appearance but the request UI follows the device — worth knowing before you do: the sheet's
     * title is drawn by the OS in the device's appearance and cannot be styled from here, so a
     * request UI pinned against the device leaves that title unreadable.
     */
    userInterfaceStyle?: 'light' | 'dark' | 'automatic'

    /**
     * Background behind the request UI, as `#RRGGBB` or `#RRGGBBAA`, or one colour per appearance.
     *
     * Visible before the JS has rendered, wherever the React Native view is transparent, and behind
     * the sheet's title — so a screen that themes itself for both appearances wants the pair, or
     * the strip around the title will not match what the screen paints under it. Defaults to the
     * system background, which follows the device.
     */
    backgroundColor?: string | { light?: string; dark?: string }

    /**
     * Fonts the request UI renders with, by file name as the app bundles them — e.g.
     * `['OpenSans_400Regular.ttf']`. Empty by default: the request UI then uses the system font.
     *
     * `UIAppFonts` installs fonts for the bundle that declares them, and the extension is a separate
     * bundle, so the app's fonts do not exist in it. The named ones are registered at launch from
     * the app bundle the extension is embedded in — read in place, never copied, so nothing ships
     * twice. Name only what the request UI draws with; each font costs a few milliseconds of launch.
     *
     * A `fontFamily` still names the font's PostScript name (`OpenSans-Regular`), not the file.
     *
     * Android needs nothing here: the request UI runs in the app's own process, with its fonts.
     */
    fonts?: string[]

    /**
     * Packages to leave out of the extension's autolinking, by npm package name. The extension
     * links the same modules as the app by default, and every one of them costs binary size and
     * memory in a process with a much tighter budget than the app.
     *
     * Merged with {@link defaultExcludedPackages}.
     */
    excludedPackages?: string[]

    /**
     * Packages to link into the extension, by npm package name — everything else is left out.
     *
     * The mirror of {@link excludedPackages}, for a request UI whose dependencies are easier to
     * name than everything the app links. {@link alwaysIncludedPackages} are added for you, so the
     * list only has to name what the UI itself needs.
     *
     * It fails the other way around than an exclusion list does: leaving a package out of an
     * exclusion list makes the extension heavier, leaving one out of here makes it fail to link.
     * Native dependencies of what you list have to be listed too.
     *
     * Setting this together with {@link excludedPackages} throws.
     */
    includedPackages?: string[]
  }
}

export const extensionTargetName = 'DocumentProvider'

export const defaultEntry = 'dc-api/index'
export const entryFileExtensions = ['tsx', 'ts', 'jsx', 'js']

/**
 * Modules that cannot work inside the provider extension: they drive the app's own lifecycle, or
 * link against APIs unavailable to app extensions.
 */
export const defaultExcludedPackages = [
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-router',
  'expo-splash-screen',
  'expo-updates',
]

export function getExtensionBundleIdentifier(appBundleIdentifier: string, options: DigitalCredentialsApiPluginOptions) {
  return `${appBundleIdentifier}.${options.ios?.bundleIdSuffix ?? extensionTargetName}`
}

export function getAppGroup(appBundleIdentifier: string, options: DigitalCredentialsApiPluginOptions) {
  return options.ios?.appGroup ?? `group.${appBundleIdentifier}`
}

export function getKeychainAccessGroup(appBundleIdentifier: string, options: DigitalCredentialsApiPluginOptions) {
  return options.ios?.keychainAccessGroup ?? appBundleIdentifier
}

/**
 * Modules the extension is linked against whichever way it is configured. Leaving any of them out
 * is never intentional: the request UI cannot start without them.
 *
 * `expo-asset` is here because `expo` imports it for its side effects — `Expo.fx`, the first line
 * of the package entry — and `expo-asset` asks for its native module non-optionally. Unlinked, that
 * throws while the bundle is still evaluating, so the extension dies before it renders anything.
 */
export const alwaysIncludedPackages = [
  '@animo-id/expo-digital-credentials-api',
  'react-native',
  'expo',
  'expo-modules-core',
  'expo-asset',
]

export function getExcludedPackages(options: DigitalCredentialsApiPluginOptions) {
  const excluded = new Set([...defaultExcludedPackages, ...(options.ios?.excludedPackages ?? [])])

  const requested = (options.ios?.excludedPackages ?? []).filter((name) => alwaysIncludedPackages.includes(name))
  if (requested.length > 0) {
    console.warn(
      `[expo-digital-credentials-api] Ignoring 'ios.excludedPackages' entries the extension cannot start without: ${requested.join(', ')}`
    )
  }

  for (const name of alwaysIncludedPackages) excluded.delete(name)

  return [...excluded]
}

/**
 * The allowlist, or `undefined` when the extension is configured by exclusion instead.
 *
 * `defaultExcludedPackages` are not applied on top: nothing is linked unless it is named here, so
 * they are already out.
 */
export function getIncludedPackages(options: DigitalCredentialsApiPluginOptions) {
  const included = options.ios?.includedPackages
  if (!included) return undefined

  if (options.ios?.excludedPackages) {
    throw new Error(
      "Set either 'ios.includedPackages' or 'ios.excludedPackages', not both: an allowlist already excludes everything it does not name."
    )
  }

  return [...new Set([...alwaysIncludedPackages, ...included])]
}
