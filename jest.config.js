module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // e2e/ holds the Detox tests, run with `detox test` (see e2e/README.md)
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  // These RN packages ship untranspiled ESM and must go through babel.
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|react-native-tts|react-native-text-measure)/)',
  ],
};
