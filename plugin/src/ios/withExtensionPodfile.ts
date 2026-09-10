import fs from 'node:fs'
import path from 'node:path'
import { type ConfigPlugin, withDangerousMod } from 'expo/config-plugins'
import { replaceGeneratedBlock } from '../generatedBlock'
import {
  type DigitalCredentialsApiPluginOptions,
  extensionTargetName,
  getExcludedPackages,
  getIncludedPackages,
} from '../types'

/**
 * Adds a Podfile target for the extension, autolinking either the same modules as the app minus the
 * excluded ones, or only the included ones.
 */
export const withExtensionPodfile: ConfigPlugin<DigitalCredentialsApiPluginOptions> = (config, options) =>
  withDangerousMod(config, [
    'ios',
    (config) => {
      const iosRoot = config.modRequest.platformProjectRoot
      const projectRoot = config.modRequest.projectRoot
      const podfilePath = path.join(iosRoot, 'Podfile')
      const podfile = fs.readFileSync(podfilePath, 'utf8')

      const included = getIncludedPackages(options)
      const rubyList = (names: string[]) => names.map((name) => `'${name}'`).join(', ')

      // Relative to `ios/`, like the React Native path below: a project that commits its native
      // directories commits this Podfile too, and an absolute path only resolves on the machine
      // that ran the prebuild.
      const fromIosRoot = (file: string) => path.relative(iosRoot, file).split(path.sep).join('/')

      // `use_expo_modules!` only takes an exclusion, so an allowlist is inverted here against what
      // autolinking actually resolved — which is the real list, not a guess at what is installed.
      const useExpoModules = included
        ? `dc_api_resolve_command = ['npx', 'expo-modules-autolinking', 'resolve', '--json', '--platform', 'apple']
  dc_api_resolved, dc_api_resolve_message, dc_api_resolve_status = Pod::Executable.capture_command(dc_api_resolve_command[0], dc_api_resolve_command[1..], capture: :both)
  if not dc_api_resolve_status.success?
    Pod::UI.warn "Could not resolve Expo modules for the '${extensionTargetName}' target: #{dc_api_resolve_message}"
    exit(dc_api_resolve_status.exitstatus)
  end

  dc_api_expo_exclude = JSON.parse(dc_api_resolved)['modules'].map { |dc_api_module| dc_api_module['packageName'] } - [${rubyList(included)}]
  use_expo_modules!(exclude: dc_api_expo_exclude)`
        : `use_expo_modules!(exclude: [${rubyList(getExcludedPackages(options))}])`

      const filter = included
        ? `{ include: [${rubyList(included)}] }`
        : `{ exclude: [${rubyList(getExcludedPackages(options))}] }`

      const target = `target '${extensionTargetName}' do
  require 'json'

  # Must match the app target: mixing linkage produces both a static and a dynamic variant of
  # the same pod, which CocoaPods rejects.
  use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
  use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']
  ${useExpoModules}

  # The app target autolinks through the same command; the result is piped through a filter that
  # applies the same choice to React Native modules, which \`use_expo_modules!\` does not cover.
  dc_api_config_command = ['npx', 'expo-modules-autolinking', 'react-native-config', '--json', '--platform', 'ios']
  dc_api_json, dc_api_message, dc_api_status = Pod::Executable.capture_command(dc_api_config_command[0], dc_api_config_command[1..], capture: :both)
  if not dc_api_status.success?
    Pod::UI.warn "Autolinking failed for the '${extensionTargetName}' target: #{dc_api_message}"
    exit(dc_api_status.exitstatus)
  end

  dc_api_filter_command = [
    'node', '--no-warnings', '--eval',
    "require(#{File.join(Pod::Config.instance.installation_root.to_s, '${fromIosRoot(autolinkingFilterPath())}').to_json}).run(" + dc_api_json + ", ${filter})"
  ]

  # \`use_native_modules!\` writes its result to build/generated/autolinking/autolinking.json, and
  # codegen reads that file to decide which third-party Fabric components exist. One file is shared
  # by every target, so the filtered list below would replace the app's — leaving the app built
  # against a component list as small as this target's, and failing at runtime with
  # "Unimplemented component: <RNSScreenStack>". The app's list is put back afterwards; only the
  # return value matters for what this target links.
  dc_api_autolinking_json = File.join(
    Pod::Config.instance.installation_root.to_s, 'build', 'generated', 'autolinking', 'autolinking.json'
  )
  dc_api_app_autolinking = File.exist?(dc_api_autolinking_json) ? File.read(dc_api_autolinking_json) : nil

  config = use_native_modules!(dc_api_filter_command)

  File.write(dc_api_autolinking_json, dc_api_app_autolinking) unless dc_api_app_autolinking.nil?

  use_react_native!(
    # React Native's CLI reports \`reactNativePath\` fully resolved, so the extension has to use
    # the resolved path too or CocoaPods sees two sources for the React pods.
    :path => '${path.relative(iosRoot, resolveReactNativePath(projectRoot))}',
    :hermes_enabled => podfile_properties['expo.jsEngine'] == nil || podfile_properties['expo.jsEngine'] == 'hermes',
    :app_path => "#{Pod::Config.instance.installation_root}/..",
    :privacy_file_aggregation_enabled => false,
  )
end`

      // Appended after the app target: React Native's codegen only runs for the first
      // `use_react_native!` in the Podfile, and it must see the app's module list — otherwise the
      // app is built against codegen artifacts generated from the extension's much smaller one.
      const body = `${target}\n\n${nilSafeComponentsHook(fromIosRoot(nilSafeComponentsScriptPath()))}`
      fs.writeFileSync(podfilePath, replaceGeneratedBlock(callHookFromPostInstall(podfilePath, podfile), '#', body))

      return config
    },
  ])

/** The name of the Ruby method below, and the anchor that keeps the call in `post_install` unique. */
const hookName = 'dc_api_nil_safe_third_party_components'

/**
 * Adds a build phase to the `ReactCodegen` pod target that rewrites the generated
 * `RCTThirdPartyComponentsProvider` — see `thirdPartyComponentsProvider.ts` for what that file does
 * and why leaving a Fabric component package out of the extension crashes it without this.
 *
 * A build phase rather than a rewrite here: codegen's own `Generate Specs` phase regenerates the
 * file on every build, so anything done at install time is overwritten before it is compiled. The
 * phase is ordered directly after it, and before the sources it feeds.
 *
 * `scriptPath` is the built rewriter the phase runs, relative to `ios/` — passed in rather than
 * resolved here so this stays a pure function of what it generates.
 */
export const nilSafeComponentsHook = (scriptPath: string) => `def ${hookName}(installer)
  codegen = installer.pods_project.targets.find { |target| target.name == 'ReactCodegen' }
  if codegen.nil?
    Pod::UI.warn "[expo-digital-credentials-api] No ReactCodegen target: leaving the third-party component provider as generated. Excluding a package that registers a Fabric component will crash the '${extensionTargetName}' target."
    return
  end

  name = '[expo-digital-credentials-api] Nil-safe third-party components'
  phase = codegen.shell_script_build_phases.find { |build_phase| build_phase.name == name }
  phase ||= codegen.new_shell_script_build_phase(name)

  # \`.xcode.env\` is where a project pins the node it builds with, and codegen's own phase reads it
  # the same way. No node is not a build failure: the file is then left exactly as generated, which
  # is what every project that links everything already builds against.
  phase.shell_script = <<-DC_API_SH
set -e
if [ -f "$PODS_ROOT/../.xcode.env" ]; then . "$PODS_ROOT/../.xcode.env"; fi
if [ -f "$PODS_ROOT/../.xcode.env.local" ]; then . "$PODS_ROOT/../.xcode.env.local"; fi
if [ -z "$NODE_BINARY" ]; then NODE_BINARY="$(command -v node || true)"; fi
if [ -z "$NODE_BINARY" ]; then
  echo "warning: [expo-digital-credentials-api] node not found, leaving RCTThirdPartyComponentsProvider as generated"
  exit 0
fi
"$NODE_BINARY" "$PODS_ROOT/../${scriptPath}" "$PODS_ROOT/../build/generated/ios"
DC_API_SH

  # Codegen rewrites the file every build, so this has to as well; without it Xcode decides the
  # phase has no outputs to bring up to date and skips it.
  phase.always_out_of_date = '1'
  phase.show_env_vars_in_log = '0'

  phase_index = codegen.build_phases.index(phase)
  codegen.build_phases.delete_at(phase_index) unless phase_index.nil?

  # Matched on the suffix: CocoaPods prefixes a podspec's script phases with '[CP-User] ', so the
  # phase codegen declares as 'Generate Specs' is '[CP-User] Generate Specs' by the time it is here.
  generate_specs = codegen.build_phases.index do |build_phase|
    build_phase.respond_to?(:name) && build_phase.name.to_s.end_with?('Generate Specs')
  end

  # Before the sources compile is the requirement; after codegen wrote them is the refinement. If
  # the phases are ever named something else, landing in front of the compile still holds.
  sources = codegen.build_phases.index { |build_phase| build_phase.isa == 'PBXSourcesBuildPhase' }
  insert_at = generate_specs.nil? ? (sources || codegen.build_phases.length) : generate_specs + 1

  codegen.build_phases.insert(insert_at, phase)
end`

/**
 * Calls the hook from the Podfile's own `post_install`.
 *
 * It cannot be declared in the generated block: CocoaPods raises on a second \`post_install\`, and
 * the app's already runs \`react_native_post_install\`. So a single line goes into the existing one
 * — guarded, so removing this package leaves a Podfile that still evaluates rather than one that
 * fails on a method that is no longer defined.
 */
export function callHookFromPostInstall(podfilePath: string, podfile: string) {
  if (podfile.includes(`${hookName}(`)) return podfile

  const postInstall = podfile.match(/^([ \t]*)post_install do \|([A-Za-z_][A-Za-z0-9_]*)\|[ \t]*$/m)
  if (!postInstall) {
    throw new Error(
      `Could not find a 'post_install do |installer|' block in ${podfilePath}. The digital credentials API config plugin adds one line to it, so that the extension can leave out React Native modules the app links. Add an empty 'post_install do |installer|' block and prebuild again.`
    )
  }

  const [matched, indent, installer] = postInstall
  const call = `${indent}  ${hookName}(${installer}) if respond_to?(:${hookName}, true) # @generated expo-digital-credentials-api`

  return podfile.replace(matched, `${matched}\n${call}`)
}

function resolveReactNativePath(projectRoot: string) {
  return path.dirname(require.resolve('react-native/package.json', { paths: [projectRoot] }))
}

/**
 * The built filter next to this file — resolving it through the app's node_modules would miss
 * linked checkouts, which is how the example app consumes the package.
 *
 * Resolved on use rather than on load: the built file only exists next to the source once the
 * package has been built, and importing this module has to work before that.
 */
const autolinkingFilterPath = () => require.resolve('../autolinkingFilter')

/** Resolved the same way, and for the same reason, as {@link autolinkingFilterPath}. */
const nilSafeComponentsScriptPath = () => require.resolve('./thirdPartyComponentsProvider')
