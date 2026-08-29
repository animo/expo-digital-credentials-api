// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const workspaceRoot = path.resolve(__dirname, '..')
const config = getDefaultConfig(__dirname)

// The library is a workspace package, so Metro has to watch it and resolve from both node_modules.
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
})

module.exports = config
