// react-native preset runs the React Native babel transform so react-native and
// RNTL load without the bundler-based transpilation issues a plain jest runner hits.
const path = require('node:path');

const reactDir = path.dirname(require.resolve('react/package.json'));

module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^react$': path.join(reactDir, 'index.js'),
    '^react/(.*)$': path.join(reactDir, '$1'),
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native-keychain$': '<rootDir>/tests/mocks/react-native-keychain.ts',
    '^react-native-vector-icons/Ionicons$': '<rootDir>/tests/mocks/react-native-vector-icons.ts',
    '^react-native-config$': '<rootDir>/tests/mocks/react-native-config.ts',
  },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!(.*?(react-native|@react-native|@react-native-community|@react-navigation|react-native-.*|@tanstack|zustand|uuid|@expyrico)))',
  ],
};
