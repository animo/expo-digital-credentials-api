import { describe, expect, it } from 'vitest'
import { assertExtensionFonts } from '../ios/withExtensionFonts'

/**
 * The parts of an Xcode project `assertExtensionFonts` reads: an app target with a resources build
 * phase, and the file references its build files point at.
 */
function projectBundling(fileNames: string[]) {
  const files = fileNames.map((name, index) => ({ value: `build-file-${index}`, name }))

  return {
    findTargetKey: (name: string) => (name === 'App' ? 'app-target' : undefined),
    pbxNativeTargetSection: () => ({
      'app-target': { buildPhases: [{ value: 'resources-phase' }] },
    }),
    pbxFileReferenceSection: () => Object.fromEntries(files.map(({ value, name }) => [`file-ref-${value}`, { name }])),
    hash: {
      project: {
        objects: {
          PBXResourcesBuildPhase: { 'resources-phase': { files: files.map(({ value }) => ({ value })) } },
          PBXBuildFile: Object.fromEntries(files.map(({ value }) => [value, { fileRef: `file-ref-${value}` }])),
        },
      },
    },
  }
}

describe('assertExtensionFonts', () => {
  const project = projectBundling(['OpenSans_400Regular.ttf', 'Raleway_700Bold.otf', 'Images.xcassets'])

  it('accepts fonts the app bundles', () => {
    expect(() => assertExtensionFonts(project, 'App', ['OpenSans_400Regular.ttf', 'Raleway_700Bold.otf'])).not.toThrow()
  })

  it('rejects a name the app does not bundle, and says what it does', () => {
    expect(() => assertExtensionFonts(project, 'App', ['OpenSans-Regular.ttf'])).toThrow(
      /'OpenSans-Regular.ttf', which the app does not bundle.*OpenSans_400Regular\.ttf/s
    )
  })

  it('passes when nothing is configured', () => {
    expect(() => assertExtensionFonts(project, 'App', undefined)).not.toThrow()
    expect(() => assertExtensionFonts(project, 'App', [])).not.toThrow()
  })

  // The app's fonts are added by other plugins, and this package's mods can run before them.
  it('skips the check when the app target has no fonts to compare against', () => {
    expect(() => assertExtensionFonts(projectBundling(['Images.xcassets']), 'App', ['Any.ttf'])).not.toThrow()
    expect(() => assertExtensionFonts(project, 'Missing', ['Any.ttf'])).not.toThrow()
  })
})
