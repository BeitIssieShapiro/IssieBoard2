const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [
    // Watch the apps directory for IssieVoice
    path.resolve(__dirname, 'apps/issievoice'),
    // issie-shared is installed as file: - Metro must watch it explicitly
    path.resolve(__dirname, '../../issie-shared'),
  ],
  resolver: {
    // Allow importing from apps/ directory
    extraNodeModules: {
      'apps': path.resolve(__dirname, 'apps'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
