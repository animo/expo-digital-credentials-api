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
// bundle — built the way the app's own is, with the node and Expo CLI the \`react\` block resolves.
// Variants the app loads from Metro, the request UI does too.
abstract class DcApiBundleTask extends Exec {
    @OutputDirectory abstract DirectoryProperty getJsBundleDir()
    @OutputDirectory abstract DirectoryProperty getResourcesDir()

    /** Where the app's own bundle task writes its images. */
    @InputFiles abstract DirectoryProperty getAppResourcesDir()
}

// Looked up by name: inside the closures below \`react\` resolves against their delegates instead.
def dcApiReact = project.extensions.getByName("react")
def dcApiCommand = dcApiReact.nodeExecutableAndArgs.get() + [dcApiReact.cliFile.get().asFile.absolutePath]

androidComponents {
    onVariants(selector().all()) { variant ->
        if (dcApiReact.debuggableVariants.get().any { it.equalsIgnoreCase(variant.name) }) return

        def variantName = variant.name.capitalize()
        def appBundle = project.tasks.named("createBundle\${variantName}JsAndAssets")

        def bundleDcApi = project.tasks.register("bundleDcApi\${variantName}JsAndAssets", DcApiBundleTask) {
            description = "Bundles the digital credentials API request UI"
            workingDir rootProject.projectDir.parentFile
            appResourcesDir.set(appBundle.flatMap { it.resourcesDir })
            // Nothing the bundle is built from is declared, so without this it would never rebuild.
            outputs.upToDateWhen { false }
            doFirst {
                commandLine(dcApiCommand + [
                    "export:embed",
                    "--platform", "android",
                    "--dev", "false",
                    "--entry-file", "${entryFile}",
                    "--bundle-output", new File(jsBundleDir.get().asFile, "${bundleAsset}").absolutePath,
                    "--assets-dest", resourcesDir.get().asFile.absolutePath
                ])
            }
            // Both bundles' images end up in the same variant's resources, where AGP rejects one
            // defined twice — and an image both UIs use is exactly that. A resource is named after
            // the image's path, so one the app already ships is the same file: drop this copy.
            doLast {
                def resources = resourcesDir.get().asFile
                def appResources = appResourcesDir.get().asFile
                resources.eachFileRecurse(groovy.io.FileType.FILES) { resource ->
                    if (new File(appResources, resources.toPath().relativize(resource.toPath()).toString()).exists()) {
                        resource.delete()
                    }
                }
            }
        }

        // Generated sources rather than files under src/main: packaged like the app's own bundle and
        // images — the images land in res/, not assets/ — and removed by \`clean\`.
        variant.sources.assets.addGeneratedSourceDirectory(bundleDcApi, { it.jsBundleDir })
        variant.sources.res.addGeneratedSourceDirectory(bundleDcApi, { it.resourcesDir })
    }
}`
}
