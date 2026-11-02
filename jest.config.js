const expoPreset = require('jest-expo/ios/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo/ios',
  setupFiles: ['<rootDir>/test/setup.ts'],
  resolver: 'react-native-worklets/jest/resolver',
  // jest-expo's transforms, plus .sql migrations as strings.
  transform: { ...expoPreset.transform, '\\.sql$': '<rootDir>/test/sql-transform.js' },
  moduleFileExtensions: [...expoPreset.moduleFileExtensions, 'sql'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|react-native-unistyles|react-native-nitro-modules|intl-messageformat|@formatjs/.*|i18next-icu|standard-navigation)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/', '/docs/'],
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
