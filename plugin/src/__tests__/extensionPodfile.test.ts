import { describe, expect, test } from 'vitest'

import { callHookFromPostInstall, nilSafeComponentsHook } from '../ios/withExtensionPodfile'

const podfile = (postInstall = '  post_install do |installer|\n    react_native_post_install(installer)\n  end') => `require 'json'

target 'App' do
  use_react_native!()

${postInstall}
end
`

describe('callHookFromPostInstall', () => {
  test('calls the hook from the block the app already has', () => {
    const withCall = callHookFromPostInstall('Podfile', podfile())

    expect(withCall).toContain('dc_api_nil_safe_third_party_components(installer)')
    // The app's own hook has to keep running: it is what configures every pod target.
    expect(withCall).toContain('react_native_post_install(installer)')
  })

  test('guards the call, so removing this package leaves a Podfile that still evaluates', () => {
    expect(callHookFromPostInstall('Podfile', podfile())).toContain(
      'if respond_to?(:dc_api_nil_safe_third_party_components, true)'
    )
  })

  test('adds nothing the second time', () => {
    const once = callHookFromPostInstall('Podfile', podfile())

    expect(callHookFromPostInstall('Podfile', once)).toEqual(once)
  })

  test('uses the name the block gave the installer', () => {
    const withCall = callHookFromPostInstall('Podfile', podfile('  post_install do |inst|\n  end'))

    expect(withCall).toContain('dc_api_nil_safe_third_party_components(inst)')
  })

  test('says what to do when there is no post_install to call it from', () => {
    expect(() => callHookFromPostInstall('ios/Podfile', "target 'App' do\nend\n")).toThrow(
      /post_install do \|installer\|.*ios\/Podfile|ios\/Podfile.*post_install/s
    )
  })
})

describe('nilSafeComponentsHook', () => {
  const scriptPath =
    '../node_modules/@animo-id/expo-digital-credentials-api/plugin/build/plugin/src/ios/thirdPartyComponentsProvider.js'

  // The Podfile is committed along with `ios/` in some projects, and an absolute path only exists on
  // the machine that ran the prebuild.
  test('runs the script relative to the project, not from an absolute path', () => {
    expect(nilSafeComponentsHook(scriptPath)).toContain(`"$NODE_BINARY" "$PODS_ROOT/../${scriptPath}"`)
  })

  // CocoaPods renames a podspec's script phases to '[CP-User] <name>', so an equality check finds
  // nothing and the rewrite lands *before* codegen regenerates the file — silently doing nothing.
  test("finds codegen's phase by suffix, not by its declared name", () => {
    expect(nilSafeComponentsHook(scriptPath)).toContain("end_with?('Generate Specs')")
  })

  // Xcode skips a phase it believes is up to date, and codegen rewrites the file on every build.
  test('runs on every build', () => {
    expect(nilSafeComponentsHook(scriptPath)).toContain("phase.always_out_of_date = '1'")
  })

  test('reuses the phase it already added, so a second pod install does not stack another', () => {
    expect(nilSafeComponentsHook(scriptPath)).toContain('phase ||= codegen.new_shell_script_build_phase(name)')
  })
})
