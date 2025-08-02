/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const {
  resolver: { sourceExts, assetExts },
} = getDefaultConfig(__dirname);

const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [...sourceExts, 'svg'],
    // Fix Socket.IO module resolution issues
    resolveRequest: (context, moduleName, platform) => {
      // Let Metro resolve socket.io modules normally
      if (moduleName.includes('socket.io') || moduleName.includes('engine.io')) {
        return context.resolveRequest(context, moduleName, platform);
      }
      // Default resolution for other modules
      return context.resolveRequest(context, moduleName, platform);
    },
  },
  // Suppress the specific warnings
  reporter: {
    update: () => { }, // Suppress update messages that include warnings
  },
};

module.exports = mergeConfig(defaultConfig, config);