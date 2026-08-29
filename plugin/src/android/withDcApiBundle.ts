import { AndroidConfig, type ConfigPlugin, withAndroidManifest, withAppBuildGradle } from 'expo/config-plugins'
import { getBundleRoot, resolveEntryFile } from '../entry'
import { replaceGeneratedBlock } from '../generatedBlock'
import type { DigitalCredentialsApiPluginOptions } from '../types'

const entryMetaData = 'id.animo.digitalcredentials.ENTRY'
const bundleAsset = 'dc-api.android.bundle'

/**
 * Bundles the credential request UI separately from the app, so the same entry file drives it on
 * both platforms. Debug builds load it from Metro; release builds embed {@link bundleAsset}.
 */
export const withAndroidDcApiBundle: ConfigPlugin<DigitalCredentialsApiPluginOptions> = (config, options) => {
  const withMetaData = withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults)
    // The react host uses this as its `jsMainModulePath`, i.e. what it asks Metro for.
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      mainApplication,
      entryMetaData,
      getBundleRoot(config.modRequest.projectRoot, options)
    )

    return config
  })

  return withAppBuildGradle(withMetaData, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('The digital credentials API config plugin only supports a groovy app/build.gradle')
    }

    const entryFile = resolveEntryFile(config.modRequest.projectRoot, options, 'android')
    config.modResults.contents = replaceGeneratedBlock(config.modResults.contents, '//', bundleTask(entryFile))

    return config
  })
}

function bundleTask(entryFile: string) {
  return `// The credential request UI has its own entry point and its own react host, so it needs its own
// bundle. Debug builds load it from Metro instead.
android.applicationVariants.configureEach { variant ->
    if (variant.buildType.debuggable) return

    def variantName = variant.name.capitalize()
    def dcApiProjectRoot = rootProject.projectDir.parentFile
    def dcApiAssetsDir = file("\${projectDir}/src/main/assets")

    def bundleDcApi = tasks.register("bundleDcApi\${variantName}JsAndAssets", Exec) {
        description = "Bundles the digital credentials API request UI"
        workingDir dcApiProjectRoot
        doFirst { dcApiAssetsDir.mkdirs() }
        commandLine "npx", "expo", "export:embed",
            "--platform", "android",
            "--dev", "false",
            "--entry-file", "${entryFile}",
            "--bundle-output", "\${dcApiAssetsDir}/${bundleAsset}",
            "--assets-dest", "\${buildDir}/generated/dcApiAssets/\${variant.name}"
    }

    tasks.named("merge\${variantName}Assets").configure { dependsOn(bundleDcApi) }
}`
}
