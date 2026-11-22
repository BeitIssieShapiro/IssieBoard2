// Native modules that have no JS fallback under jest.
jest.mock('react-native-localize', () => require('react-native-localize/mock'));
