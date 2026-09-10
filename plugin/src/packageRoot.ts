import fs from 'node:fs'
import path from 'node:path'

const packageName = '@animo-id/expo-digital-credentials-api'

/**
 * Root of this package, where its `package.json` and the vendored `ios/` sources are.
 *
 * Found by walking up rather than by counting `..`: the plugin runs from `plugin/src` under test and
 * from `plugin/build/plugin/src` once built. The build is nested because the plugin also compiles
 * `src/iosDocumentTypes.ts`, which it shares with the module.
 */
export const packageRoot = findPackageRoot(__dirname)

function findPackageRoot(from: string): string {
  let directory = from

  while (true) {
    const packageJsonPath = path.join(directory, 'package.json')
    if (fs.existsSync(packageJsonPath) && JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).name === packageName) {
      return directory
    }

    const parent = path.dirname(directory)
    if (parent === directory) throw new Error(`Could not find the root of ${packageName} above ${from}`)
    directory = parent
  }
}
