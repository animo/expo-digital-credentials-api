import { type ConfigPlugin, withXcodeProject } from 'expo/config-plugins'
import { resolveEntryFile } from '../entry'
import { type DigitalCredentialsApiPluginOptions, extensionTargetName, getExtensionBundleIdentifier } from '../types'
import { unquote } from './pbxproj'
import { allExtensionFiles, getExtensionEntitlementsPath } from './withExtensionFiles'
import { assertExtensionFonts } from './withExtensionFonts'

const defaultDeploymentTarget = '26.0'
const bundleJsPhaseName = 'Bundle Extension JS'

/**
 * Creates the ExtensionKit "Identity Document Provider" target, embeds it in the app, and adds the
 * build phase that bundles the extension's own JS.
 */
export const withExtensionTarget: ConfigPlugin<DigitalCredentialsApiPluginOptions> = (config, options) =>
  withXcodeProject(config, (config) => {
    applyExtensionTarget(config.modResults, {
      appBundleIdentifier: config.ios?.bundleIdentifier as string,
      appTargetName: config.modRequest.projectName as string,
      projectRoot: config.modRequest.projectRoot,
      options,
    })

    return config
  })

/**
 * The part of {@link withExtensionTarget} that edits the project, run on every prebuild — the first
 * one creates the target, later ones bring it up to date.
 */
export function applyExtensionTarget(
  // biome-ignore lint/suspicious/noExplicitAny: the `xcode` package ships no useful types
  project: any,
  {
    appBundleIdentifier,
    appTargetName,
    projectRoot,
    options,
  }: {
    appBundleIdentifier: string
    appTargetName: string
    projectRoot: string
    options: DigitalCredentialsApiPluginOptions
  }
) {
  const entryFile = resolveEntryFile(projectRoot, options, 'ios')
  const buildSettings = {
    target: extensionTargetName,
    appBundleIdentifier,
    deploymentTarget: options.ios?.deploymentTarget ?? defaultDeploymentTarget,
    options,
    // Pods shared with the app (Expo, React) can only be built for one Swift language version,
    // so the extension has to use whatever the app uses.
    swiftVersion: getAppSwiftVersion(project, appTargetName) ?? '5.0',
  }

  // A prebuild over an existing `ios/` keeps the target, so everything derived from the options is
  // applied again rather than left as the first prebuild wrote it. The vendored file list can have
  // grown too — `withExtensionFiles` copies the new file in either way, and one that is never added
  // to the target is silently not compiled.
  //
  // Found by key rather than with `pbxTargetByName`, which matches the target's comment: `addTarget`
  // writes that quoted, so the lookup never finds the target it created and every prebuild would
  // add another.
  if (findTargetUuid(project, extensionTargetName)) {
    addMissingExtensionFiles(project, extensionTargetName)
    setExtensionBuildSettings(project, buildSettings)
    setBundleJsEntryFile(project, entryFile)
    assertExtensionFonts(project, appTargetName, options.ios?.fonts)
    return
  }

  const target = project.addTarget(
    extensionTargetName,
    'app_extension',
    extensionTargetName,
    getExtensionBundleIdentifier(appBundleIdentifier, options)
  )

  // `xcode` only knows the classic app-extension product type; ExtensionKit extensions are a
  // different product type and wrapper, and the OS will not load the appex otherwise.
  project.pbxNativeTargetSection()[target.uuid].productType = '"com.apple.product-type.extensionkit-extension"'
  const productReference = project.pbxFileReferenceSection()[target.pbxNativeTarget.productReference]
  if (productReference) {
    productReference.explicitFileType = '"wrapper.extensionkit-extension"'
  }

  removePlugInsEmbedPhase(project, target)

  project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid)
  project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid)
  project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid)

  // Files are added explicitly below; passing them here as well leaves orphaned PBXBuildFile
  // entries that CocoaPods then discards with a warning.
  const group = project.addPbxGroup([], extensionTargetName, extensionTargetName)
  const groups = project.hash.project.objects.PBXGroup
  for (const key of Object.keys(groups)) {
    if (groups[key].name === undefined && groups[key].path === undefined) {
      project.addToPbxGroup(group.uuid, key)
    }
  }

  // Paths are relative to the group, which itself has `path = DocumentProvider`.
  for (const file of allExtensionFiles) {
    if (file.endsWith('.swift')) {
      project.addSourceFile(file, { target: target.uuid }, group.uuid)
    } else {
      project.addFile(file, group.uuid)
    }
  }

  setExtensionBuildSettings(project, buildSettings)

  addEmbedExtensionPhase(project, appTargetName, target)
  addBundleJsPhase(project, target, entryFile)
  weaklyLinkIdentityDocumentServices(project, appTargetName)
  // Last: the app's fonts are only all in the project once every plugin that adds one has run.
  assertExtensionFonts(project, appTargetName, options.ios?.fonts)
}

// biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
function findTargetUuid(project: any, targetName: string): string | undefined {
  return project.findTargetKey(targetName) ?? project.findTargetKey(`"${targetName}"`) ?? undefined
}

/**
 * Adds the vendored files the target does not have yet, leaving everything else alone.
 *
 * This is what keeps an incremental prebuild — one that does not regenerate `ios/` — from producing
 * an extension that is missing a source file added by a newer version of this package. The failure
 * it prevents is a quiet one: the file is on disk and looks present, it is just never built.
 */
// biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
function addMissingExtensionFiles(project: any, targetName: string) {
  const targetUuid = findTargetUuid(project, targetName)

  // Identified by its path: the CocoaPods-generated `ExpoModulesProviders/DocumentProvider` group
  // carries the same name, and adding sources to that one would build nothing.
  const groups = project.hash.project.objects.PBXGroup ?? {}
  const groupUuid = Object.keys(groups).find((key) => unquote(groups[key]?.path) === targetName)

  if (!targetUuid || !groupUuid) return

  const fileReferences = project.pbxFileReferenceSection()
  const present = new Set(
    (groups[groupUuid].children ?? []).map(({ value }: { value: string }) => unquote(fileReferences[value]?.path))
  )

  for (const file of allExtensionFiles) {
    if (present.has(file)) continue

    if (file.endsWith('.swift')) {
      project.addSourceFile(file, { target: targetUuid }, groupUuid)
    } else {
      project.addFile(file, groupUuid)
    }
  }

  // And the other direction: a source this package used to vendor and no longer does is deleted
  // from disk by `withExtensionFiles`, which turns a leftover reference into a build failure —
  // Xcode stops at "Build input file cannot be found" rather than ignoring it.
  for (const file of present) {
    if (typeof file !== 'string' || !file.endsWith('.swift') || allExtensionFiles.includes(file)) continue

    project.removeSourceFile(file, { target: targetUuid }, groupUuid)
  }
}

function setExtensionBuildSettings(
  // biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
  project: any,
  {
    target,
    appBundleIdentifier,
    deploymentTarget,
    options,
    swiftVersion,
  }: {
    target: string
    appBundleIdentifier: string
    deploymentTarget: string
    options: DigitalCredentialsApiPluginOptions
    swiftVersion: string
  }
) {
  const configurations = project.pbxXCBuildConfigurationSection()

  for (const key of Object.keys(configurations)) {
    const buildSettings = configurations[key].buildSettings
    if (!buildSettings || buildSettings.PRODUCT_NAME !== `"${target}"`) continue

    buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${getExtensionBundleIdentifier(appBundleIdentifier, options)}"`
    buildSettings.INFOPLIST_FILE = `"${target}/Info.plist"`
    buildSettings.CODE_SIGN_ENTITLEMENTS = `"${getExtensionEntitlementsPath()}"`
    buildSettings.SWIFT_VERSION = swiftVersion
    buildSettings.IPHONEOS_DEPLOYMENT_TARGET = deploymentTarget
    buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"'
    buildSettings.SKIP_INSTALL = 'YES'
    buildSettings.CURRENT_PROJECT_VERSION = '"1"'
    buildSettings.MARKETING_VERSION = '"1.0"'
    buildSettings.GENERATE_INFOPLIST_FILE = 'YES'
    // hermes.framework is dynamic and embedded in the host app, not in the appex, so the extension
    // needs an rpath into the host app's Frameworks directory or it fails to launch.
    buildSettings.LD_RUNPATH_SEARCH_PATHS =
      '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"'
  }
}

// biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
function getAppSwiftVersion(project: any, appTargetName: string): string | undefined {
  const appTargetUuid = project.findTargetKey(appTargetName) ?? project.findTargetKey(`"${appTargetName}"`)
  const appTarget = project.pbxNativeTargetSection()[appTargetUuid]
  if (!appTarget) return undefined

  const configurations = project.pbxXCBuildConfigurationSection()
  const configurationList = project.hash.project.objects.XCConfigurationList[appTarget.buildConfigurationList]

  for (const { value } of configurationList.buildConfigurations) {
    const swiftVersion = configurations[value].buildSettings?.SWIFT_VERSION
    if (swiftVersion) return String(swiftVersion)
  }

  return undefined
}

/**
 * `addTarget` embeds every `app_extension` product in the app's PlugIns folder. ExtensionKit
 * extensions go to Extensions/ instead (see `addEmbedExtensionPhase`), and installd refuses to
 * install an app carrying the same appex identifier in both places (`DuplicateIdentifier`).
 *
 * Only this extension's own build file is taken out: `addTarget` adds it to the first PlugIns phase
 * it finds, which can be one another plugin's extension is embedded through. The phase itself goes
 * only once nothing is left in it.
 */
// biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
function removePlugInsEmbedPhase(project: any, target: any) {
  const productReference = target.pbxNativeTarget.productReference
  const copyFilesPhases = project.hash.project.objects.PBXCopyFilesBuildPhase ?? {}
  const buildFiles = project.hash.project.objects.PBXBuildFile ?? {}

  for (const phaseUuid of Object.keys(copyFilesPhases)) {
    const phase = copyFilesPhases[phaseUuid]
    if (typeof phase !== 'object' || phase.dstSubfolderSpec !== 13) continue

    const files: Array<{ value: string }> = phase.files ?? []
    const ours = files.filter(({ value }) => buildFiles[value]?.fileRef === productReference)
    if (ours.length === 0) continue

    for (const { value } of ours) {
      delete buildFiles[value]
      delete buildFiles[`${value}_comment`]
    }

    phase.files = files.filter((file) => !ours.includes(file))
    if (phase.files.length > 0) continue

    delete copyFilesPhases[phaseUuid]
    delete copyFilesPhases[`${phaseUuid}_comment`]

    const nativeTargets = project.pbxNativeTargetSection()
    for (const key of Object.keys(nativeTargets)) {
      const nativeTarget = nativeTargets[key]
      if (typeof nativeTarget !== 'object' || !nativeTarget.buildPhases) continue

      nativeTarget.buildPhases = nativeTarget.buildPhases.filter(({ value }: { value: string }) => value !== phaseUuid)
    }
  }
}

// biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
function addEmbedExtensionPhase(project: any, appTargetName: string, target: any) {
  const appTargetUuid = project.findTargetKey(appTargetName) ?? project.findTargetKey(`"${appTargetName}"`)
  if (!appTargetUuid) throw new Error(`Could not find the app target '${appTargetName}' in the Xcode project`)

  project.addTargetDependency(appTargetUuid, [target.uuid])

  const { buildPhase } = project.addBuildPhase(
    [],
    'PBXCopyFilesBuildPhase',
    'Embed ExtensionKit Extensions',
    appTargetUuid,
    'app_extension'
  )

  // `xcode` only knows classic app extensions, which go to PlugIns. ExtensionKit extensions live in
  // the Extensions folder: destination "Products Directory" (16) + $(EXTENSIONS_FOLDER_PATH).
  buildPhase.dstSubfolderSpec = 16
  buildPhase.dstPath = '"$(EXTENSIONS_FOLDER_PATH)"'

  const productName = `${extensionTargetName}.appex`
  const buildFileUuid = project.generateUuid()
  project.hash.project.objects.PBXBuildFile[buildFileUuid] = {
    isa: 'PBXBuildFile',
    fileRef: target.pbxNativeTarget.productReference,
    fileRef_comment: productName,
    settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
  }
  project.hash.project.objects.PBXBuildFile[`${buildFileUuid}_comment`] =
    `${productName} in Embed ExtensionKit Extensions`

  buildPhase.files.push({ value: buildFileUuid, comment: `${productName} in Embed ExtensionKit Extensions` })
}

/**
 * Bundle the extension's JS with the same script the app target uses, only with a different entry
 * file. `react-native-xcode.sh` derives its destination from the target being built, so it writes
 * into the appex, and it also handles the Hermes bytecode compilation.
 */
// biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
function addBundleJsPhase(project: any, target: any, entryFile: string) {
  project.addBuildPhase([], 'PBXShellScriptBuildPhase', bundleJsPhaseName, target.uuid, {
    shellPath: '/bin/sh',
    shellScript: `if [[ -f "$PODS_ROOT/../.xcode.env" ]]; then source "$PODS_ROOT/../.xcode.env"; fi
if [[ -f "$PODS_ROOT/../.xcode.env.local" ]]; then source "$PODS_ROOT/../.xcode.env.local"; fi

export PROJECT_ROOT="$PROJECT_DIR"/..
export ENTRY_FILE="${entryFile}"
# Debug builds load from Metro, like the app target does — set FORCE_BUNDLING=1 to embed anyway.

if [[ -z "$CLI_PATH" ]]; then
  export CLI_PATH="$("$NODE_BINARY" --print "require.resolve('@expo/cli', { paths: [require.resolve('expo/package.json')] })")"
fi
if [[ -z "$BUNDLE_COMMAND" ]]; then
  export BUNDLE_COMMAND="export:embed"
fi

\`"$NODE_BINARY" --print "require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'"\``,
  })
}

/**
 * Points the existing {@link addBundleJsPhase} phase at the current entry file, which the `entry`
 * option or a new platform variant (`index.ios.tsx`) can have changed since it was written.
 *
 * The script is stored quoted, with its own quotes escaped — `ENTRY_FILE=\"dc-api/index.tsx\"` —
 * both when `xcode` has just written it and when it is read back from disk.
 */
// biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
function setBundleJsEntryFile(project: any, entryFile: string) {
  const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {}

  for (const key of Object.keys(phases)) {
    const phase = phases[key]
    if (typeof phase !== 'object' || unquote(phase.name) !== bundleJsPhaseName) continue

    phase.shellScript = String(phase.shellScript).replace(
      /ENTRY_FILE=\\"[^"\\]*\\"/,
      () => `ENTRY_FILE=\\"${entryFile}\\"`
    )
  }
}

// biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
function weaklyLinkIdentityDocumentServices(project: any, appTargetName: string) {
  const appTargetUuid = project.findTargetKey(appTargetName) ?? project.findTargetKey(`"${appTargetName}"`)
  const appTarget = project.pbxNativeTargetSection()[appTargetUuid]
  if (!appTarget) return

  const configurations = project.pbxXCBuildConfigurationSection()
  const configurationList = project.hash.project.objects.XCConfigurationList[appTarget.buildConfigurationList]

  for (const { value } of configurationList.buildConfigurations) {
    const buildSettings = configurations[value].buildSettings
    const existing = buildSettings.OTHER_LDFLAGS ?? ['"$(inherited)"']
    const flags = Array.isArray(existing) ? existing : [existing]

    // Weak linking keeps the app launchable on iOS < 26, where the framework does not exist.
    if (flags.includes('"IdentityDocumentServices"')) continue
    buildSettings.OTHER_LDFLAGS = [...flags, '"-weak_framework"', '"IdentityDocumentServices"']
  }
}
