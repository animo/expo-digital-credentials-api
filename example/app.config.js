module.exports = ({ config }) => ({
  ...config,
  plugins: [
    [
      '../app.plugin.js',
      {
        ios: {
          documentTypes: ['org.iso.18013.5.1.mDL', 'eu.europa.ec.eudi.pid.1'],
          // Provisioning profiles cannot carry this entitlement yet, so only simulator builds opt in.
          verifiableCredentialTypes: process.env.DC_API_IOS_OPENID4VP === '1' ? ['urn:eudi:pid:1'] : [],
          excludedPackages: ['react-native-safe-area-context'],
        },
      },
    ],
  ],
})
