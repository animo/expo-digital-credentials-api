import { beforeEach, describe, expect, test, vi } from 'vitest'

import { run } from '../autolinkingFilter'
import { getExcludedPackages, getIncludedPackages } from '../types'

const config = () => ({
  dependencies: {
    'react-native-keychain': {},
    'react-native-mmkv': {},
    '@shopify/react-native-skia': {},
  },
  project: {},
})

const filtered = () => JSON.parse(vi.mocked(console.log).mock.calls[0][0])

describe('autolinking filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  test('drops the excluded packages and keeps the rest', () => {
    run(config(), { exclude: ['react-native-mmkv'] })

    expect(Object.keys(filtered().dependencies)).toEqual(['react-native-keychain', '@shopify/react-native-skia'])
  })

  test('keeps only the included packages', () => {
    run(config(), { include: ['react-native-keychain'] })

    expect(Object.keys(filtered().dependencies)).toEqual(['react-native-keychain'])
  })

  test('leaves the rest of the autolinking config untouched', () => {
    run(config(), { include: [] })

    expect(filtered()).toEqual({ dependencies: {}, project: {} })
  })

  test('refuses a config that is not an autolinking config', () => {
    expect(() => run({}, { exclude: [] })).toThrow('Expected a react-native autolinking config')
  })
})

describe('getIncludedPackages', () => {
  test('is undefined when the extension is configured by exclusion', () => {
    expect(getIncludedPackages({ ios: { excludedPackages: ['expo-image'] } })).toBeUndefined()
  })

  test('adds what the extension cannot start without', () => {
    expect(getIncludedPackages({ ios: { includedPackages: ['react-native-keychain'] } })).toEqual([
      '@animo-id/expo-digital-credentials-api',
      'react-native',
      'expo',
      'expo-modules-core',
      'expo-asset',
      'react-native-keychain',
    ])
  })

  test('keeps what expo pulls in for its side effects', () => {
    // `expo` imports expo-asset from Expo.fx, which asks for its native module non-optionally.
    expect(getIncludedPackages({ ios: { includedPackages: [] } })).toContain('expo-asset')
  })

  test('rejects an allowlist and a denylist at the same time', () => {
    expect(() => getIncludedPackages({ ios: { includedPackages: ['a'], excludedPackages: ['b'] } })).toThrow(
      "Set either 'ios.includedPackages' or 'ios.excludedPackages'"
    )
  })
})

describe('getExcludedPackages', () => {
  test('excludes the modules an app extension cannot run', () => {
    expect(getExcludedPackages({})).toEqual(expect.arrayContaining(['expo-router', 'expo-updates']))
  })

  test('merges what the caller asked for', () => {
    expect(getExcludedPackages({ ios: { excludedPackages: ['expo-image'] } })).toContain('expo-image')
  })

  test('refuses to exclude what the extension cannot start without', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const excluded = getExcludedPackages({ ios: { excludedPackages: ['expo-asset', 'expo-image'] } })

    expect(excluded).not.toContain('expo-asset')
    expect(excluded).toContain('expo-image')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('expo-asset'))
  })
})
