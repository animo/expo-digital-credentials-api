require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'DigitalCredentialsApi'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  # The app itself stays installable on older iOS; every IdentityDocumentServices call is behind
  # an availability check.
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/animo/expo-digital-credentials-api.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.weak_framework = 'IdentityDocumentServices'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "*.{h,m,swift}"
end
