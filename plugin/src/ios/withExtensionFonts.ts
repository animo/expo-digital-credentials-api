import path from 'node:path'
import { unquote } from './pbxproj'

const fontExtensions = ['.ttf', '.otf', '.ttc']

/**
 * Checks that every font named in `ios.fonts` is one the app actually bundles.
 *
 * The extension registers them from the app's bundle at launch, so a name that is not there is a
 * request UI in the system font and nothing else — no error, no crash, just the wrong typeface,
 * found by looking at it. Failing the prebuild instead is what makes a typo cheap.
 *
 * The app's fonts are read out of its resources build phase, which is where every plugin that adds
 * one puts them. That list is only complete once those plugins have run: this package's mods run
 * after a plugin listed later in the app config, which is where `expo-font` normally sits. When the
 * list comes back empty the check is skipped rather than failed, since "the app bundles no fonts"
 * and "this ran too early to see them" look the same from here.
 */
// biome-ignore lint/suspicious/noExplicitAny: the `xcode` package ships no useful types
export function assertExtensionFonts(project: any, appTargetName: string, fonts: string[] | undefined) {
  if (!fonts?.length) return

  const bundled = appFontFileNames(project, appTargetName)
  if (bundled.size === 0) return

  const missing = fonts.filter((font) => !bundled.has(font))
  if (missing.length === 0) return

  throw new Error(
    `'ios.fonts' names ${missing.map((font) => `'${font}'`).join(', ')}, which the app does not bundle. ` +
      `Fonts are named by file name, and the app bundles: ${[...bundled].join(', ')}.`
  )
}

/** The font files the app target copies into its bundle, by the name they get there. */
// biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
function appFontFileNames(project: any, appTargetName: string): Set<string> {
  const targetUuid = project.findTargetKey(appTargetName) ?? project.findTargetKey(`"${appTargetName}"`)
  const target = project.pbxNativeTargetSection()[targetUuid]
  if (!target) return new Set()

  const phases = project.hash.project.objects.PBXResourcesBuildPhase ?? {}
  const phase = (target.buildPhases ?? []).find(({ value }: { value: string }) => phases[value])
  if (!phase) return new Set()

  const buildFiles = project.hash.project.objects.PBXBuildFile ?? {}
  const fileReferences = project.pbxFileReferenceSection()

  const names: string[] = (phases[phase.value].files ?? []).map(({ value }: { value: string }) => {
    const reference = fileReferences[buildFiles[value]?.fileRef]

    // `name` is what the file is called in the project, `path` where it comes from — a font added
    // from node_modules has both, and only the name says what lands in the bundle.
    return unquote(reference?.name) ?? path.basename(unquote(reference?.path) ?? '')
  })

  return new Set(names.filter((name) => fontExtensions.includes(path.extname(name).toLowerCase())))
}
