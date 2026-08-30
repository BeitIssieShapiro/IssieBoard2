module.exports = {
  preset: '@react-native/jest-preset',
  // These RN packages ship untranspiled ESM and must go through babel.
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|react-native-tts|react-native-text-measure)/)',
  ],
};
