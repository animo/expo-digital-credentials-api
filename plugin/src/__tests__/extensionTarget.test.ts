import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { IOSConfig } from 'expo/config-plugins'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { applyExtensionTarget } from '../ios/withExtensionTarget'
import type { DigitalCredentialsApiPluginOptions } from '../types'

/** A bare Expo app project: one `App` target, nothing added by a plugin yet. */
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'App.pbxproj'), 'utf8')

let projectRoot: string

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-api-extension-target-'))
  fs.mkdirSync(path.join(projectRoot, 'ios', 'App.xcodeproj'), { recursive: true })
  fs.writeFileSync(path.join(projectRoot, 'ios', 'App.xcodeproj', 'project.pbxproj'), fixture)
  fs.mkdirSync(path.join(projectRoot, 'dc-api'))
  fs.writeFileSync(path.join(projectRoot, 'dc-api', 'index.tsx'), '')
})

afterEach(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true })
})

/**
 * One prebuild's worth of the target mod, through the same parse and write a prebuild does — which
 * is what matters: `xcode` hands back quoted values after a round trip that it did not before.
 */
// biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
function prebuild(options: DigitalCredentialsApiPluginOptions = {}, before?: (project: any) => void) {
  const project = IOSConfig.XcodeUtils.getPbxproj(projectRoot)
  before?.(project)
  applyExtensionTarget(project, {
    appBundleIdentifier: 'com.example.app',
    appTargetName: 'App',
    projectRoot,
    options,
  })
  fs.writeFileSync(path.join(projectRoot, 'ios', 'App.xcodeproj', 'project.pbxproj'), project.writeSync())

  return IOSConfig.XcodeUtils.getPbxproj(projectRoot)
}

// biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
function comments(section: Record<string, any>) {
  return Object.keys(section)
    .filter((key) => key.endsWith('_comment'))
    .map((key) => section[key])
}

// biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
function extensionBuildSettings(project: any) {
  return (
    Object.values(project.pbxXCBuildConfigurationSection())
      .filter((configuration) => typeof configuration === 'object')
      // biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
      .map((configuration: any) => configuration.buildSettings)
      .filter((buildSettings) => buildSettings?.PRODUCT_NAME === '"DocumentProvider"')
  )
}

// biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
function plugInsPhaseFileRefs(project: any) {
  const buildFiles = project.hash.project.objects.PBXBuildFile
  // biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
  return Object.values(project.hash.project.objects.PBXCopyFilesBuildPhase ?? {}).flatMap((phase: any) =>
    typeof phase === 'object' && phase.dstSubfolderSpec === 13
      ? phase.files.map(({ value }: { value: string }) => buildFiles[value]?.fileRef)
      : []
  )
}

describe('applyExtensionTarget', () => {
  test('a second prebuild keeps a single extension target', () => {
    prebuild()
    const project = prebuild()

    expect(comments(project.pbxNativeTargetSection()).filter((name) => name.includes('DocumentProvider'))).toHaveLength(
      1
    )
    expect(
      comments(project.hash.project.objects.PBXCopyFilesBuildPhase).filter(
        (name) => name === 'Embed ExtensionKit Extensions'
      )
    ).toHaveLength(1)
  })

  test('a second prebuild applies options that changed since the first', () => {
    prebuild()
    const project = prebuild({ ios: { bundleIdSuffix: 'Provider', deploymentTarget: '26.1' } })

    const buildSettings = extensionBuildSettings(project)
    expect(buildSettings).toHaveLength(2)
    for (const settings of buildSettings) {
      expect(settings.PRODUCT_BUNDLE_IDENTIFIER).toBe('"com.example.app.Provider"')
      expect(settings.IPHONEOS_DEPLOYMENT_TARGET).toBe('26.1')
    }
  })

  test('a second prebuild bundles from the entry file that exists now', () => {
    prebuild()
    fs.writeFileSync(path.join(projectRoot, 'dc-api', 'index.ios.tsx'), '')
    const project = prebuild()

    const scripts = Object.values(project.hash.project.objects.PBXShellScriptBuildPhase)
      // biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
      .filter((phase: any) => typeof phase === 'object' && phase.name === '"Bundle Extension JS"')
      // biome-ignore lint/suspicious/noExplicitAny: untyped `xcode` project
      .map((phase: any) => phase.shellScript)

    expect(scripts).toHaveLength(1)
    expect(scripts[0]).toContain('ENTRY_FILE=\\"dc-api/index.ios.tsx\\"')
  })

  test('embeds the extension in Extensions/ only, leaving another extension in PlugIns/ alone', () => {
    let widgetProduct: string | undefined
    const project = prebuild({}, (project) => {
      widgetProduct = project.addTarget('Widget', 'app_extension', 'Widget', 'com.example.app.Widget').pbxNativeTarget
        .productReference
    })

    const extensionProduct =
      project.pbxNativeTargetSection()[project.findTargetKey('"DocumentProvider"')].productReference

    expect(plugInsPhaseFileRefs(project)).toContain(widgetProduct)
    expect(plugInsPhaseFileRefs(project)).not.toContain(extensionProduct)
  })
})
