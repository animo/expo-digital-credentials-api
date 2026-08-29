import fs from 'node:fs'
import path from 'node:path'
import { type DigitalCredentialsApiPluginOptions, defaultEntry, entryFileExtensions } from './types'

/**
 * The entry of the credential request UI relative to the app, e.g. `dc-api/index`.
 */
export function getEntry(options: DigitalCredentialsApiPluginOptions) {
  return (options.entry ?? defaultEntry).replace(/^\.\//, '').replace(/\.(tsx?|jsx?)$/, '')
}

/**
 * What the platform hosts ask Metro for in development, e.g. `/dc-api/index.bundle`.
 *
 * Metro resolves bundle paths against its *server* root, which Expo moves down to the workspace root
 * in a monorepo — so in one, the app's own `dc-api/index` is served as `apps/wallet/dc-api/index`.
 * The app never notices because it asks for the virtual `.expo/.virtual-metro-entry`, but a real path
 * has to be relative to the same root Metro resolves from.
 */
export function getBundleRoot(projectRoot: string, options: DigitalCredentialsApiPluginOptions) {
  const entry = getEntry(options)
  const serverRoot = getMetroServerRoot(projectRoot)

  return path.relative(serverRoot, path.join(projectRoot, entry)).split(path.sep).join('/')
}

function getMetroServerRoot(projectRoot: string): string {
  try {
    // Resolved through `expo` rather than the project, because `@expo/config` is a transitive
    // dependency and pnpm does not hoist it.
    const expoPackage = require.resolve('expo/package.json', { paths: [projectRoot] })
    const paths = require(require.resolve('@expo/config/paths', { paths: [path.dirname(expoPackage)] }))

    return paths.getMetroServerRoot(projectRoot)
  } catch {
    // Older Expo versions have no such helper, and without a monorepo the two roots are the same.
    return projectRoot
  }
}

/**
 * The concrete file the release bundle is built from, preferring the platform variant. Metro does
 * this resolution itself in development, but the bundling step needs a real path.
 */
export function resolveEntryFile(
  projectRoot: string,
  options: DigitalCredentialsApiPluginOptions,
  platform: 'ios' | 'android'
) {
  const entry = getEntry(options)
  const candidates = [
    ...entryFileExtensions.map((extension) => `${entry}.${platform}.${extension}`),
    ...entryFileExtensions.map((extension) => `${entry}.${extension}`),
  ]

  const entryFile = candidates.find((candidate) => fs.existsSync(path.join(projectRoot, candidate)))
  if (!entryFile) {
    throw new Error(
      `No entry file found for the digital credentials API request UI. Create '${entry}.tsx' in '${projectRoot}', or set the 'entry' plugin option.`
    )
  }

  return entryFile
}
