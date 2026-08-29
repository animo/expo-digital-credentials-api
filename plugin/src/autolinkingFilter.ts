/**
 * Filters a React Native autolinking config before CocoaPods consumes it.
 *
 * The extension's Podfile target pipes `react-native-config` through this, mirroring what
 * `use_expo_modules!` does for Expo modules — which only covers Expo modules, and only by exclusion.
 */
export type PackageFilter = { exclude: string[] } | { include: string[] }

export function run(config: { dependencies?: Record<string, unknown> }, filter: PackageFilter) {
  if (typeof config !== 'object' || !config?.dependencies) {
    throw new Error('Expected a react-native autolinking config with a dependencies key')
  }

  if ('include' in filter) {
    for (const packageName of Object.keys(config.dependencies)) {
      if (!filter.include.includes(packageName)) delete config.dependencies[packageName]
    }
  } else {
    for (const packageName of filter.exclude) {
      delete config.dependencies[packageName]
    }
  }

  console.log(JSON.stringify(config))
}
