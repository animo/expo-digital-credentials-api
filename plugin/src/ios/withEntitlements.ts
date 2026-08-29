import { type ConfigPlugin, withEntitlementsPlist, withInfoPlist } from 'expo/config-plugins'
import { iosSupportedDocumentTypes } from '../documentTypes'
import { type DigitalCredentialsApiPluginOptions, getAppGroup, getKeychainAccessGroup } from '../types'

const mobileDocumentTypesEntitlement =
  'com.apple.developer.identity-document-services.document-provider.mobile-document-types'

export const withAppEntitlements: ConfigPlugin<DigitalCredentialsApiPluginOptions> = (config, options) => {
  const documentTypes = options.ios?.documentTypes ?? []
  const invalid = documentTypes.filter(
    (documentType) => !(iosSupportedDocumentTypes as readonly string[]).includes(documentType)
  )
  if (invalid.length > 0) {
    throw new Error(
      `Unsupported iOS document type(s) ${invalid.join(', ')}. Allowed document types are ${iosSupportedDocumentTypes.join(', ')}`
    )
  }

  const bundleIdentifier = config.ios?.bundleIdentifier
  if (!bundleIdentifier) {
    throw new Error('ios.bundleIdentifier must be set to use the digital credentials API config plugin')
  }

  const appGroup = getAppGroup(bundleIdentifier, options)
  const keychainAccessGroup = getKeychainAccessGroup(bundleIdentifier, options)

  const withPlists = withEntitlementsPlist(config, (config) => {
    config.modResults[mobileDocumentTypesEntitlement] = documentTypes

    config.modResults['com.apple.security.application-groups'] = unique([
      ...toArray(config.modResults['com.apple.security.application-groups']),
      appGroup,
    ])

    // The first entry becomes the default group for new keychain items. Keeping it equal to the
    // app's bundle identifier means keys created before the extension existed keep working, and
    // the extension can read them.
    config.modResults['keychain-access-groups'] = unique([
      `$(AppIdentifierPrefix)${keychainAccessGroup}`,
      ...toArray(config.modResults['keychain-access-groups']),
    ])

    return config
  })

  return withInfoPlist(withPlists, (config) => {
    config.modResults.ANIMO_DC_API_APP_GROUP = appGroup
    // The entitlement itself is not readable from JS, and it is the entitlement — not Apple's full
    // allowed set — that decides which document types can be registered. Mirroring it here lets
    // `registerCredentials` skip what this build could never register. Only the app registers
    // documents, so the extension's Info.plist does not need it.
    config.modResults.ANIMO_DC_API_DOCUMENT_TYPES = documentTypes
    return config
  })
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') return [value]
  return []
}

function unique(values: string[]) {
  return Array.from(new Set(values))
}
