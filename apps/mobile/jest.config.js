// jest-expo is React Native's officially-supported test preset: it runs the
// Expo babel transform (strips Flow + TS, resolves .ios/.android/.native
// extensions) so react-native and RNTL load without the source-transpile issues
// a bundler-based runner hits. The three expo native modules below are redirected
// to the in-repo mocks; other native modules are stubbed in tests/setup.ts.
const path = require('node:path');

// tsconfig pins `react` at @types/react (to dodge the React 19 types hoisted by
// the admin app). jest-expo folds tsconfig paths into its resolver, which would
// then map react's RUNTIME to that types-only dir. Re-point react at the real
// installed package so the runtime resolves; tsc keeps using the tsconfig pin.
const reactDir = path.dirname(require.resolve('react/package.json'));

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^react$': path.join(reactDir, 'index.js'),
    '^react/(.*)$': path.join(reactDir, '$1'),
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo-secure-store$': '<rootDir>/tests/mocks/expo-secure-store.ts',
    '^expo-router$': '<rootDir>/tests/mocks/expo-router.ts',
    '^expo-constants$': '<rootDir>/tests/mocks/expo-constants.ts',
  },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  // jest-expo's default transformIgnorePatterns assumes a flat node_modules. pnpm
  // nests every package under node_modules/.pnpm/<name>@<ver>/node_modules/<name>,
  // so the RN/Expo ecosystem source (Flow-typed) slips past the default ignore and
  // reaches the runtime untransformed. Re-allow those packages under .pnpm too.
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!(.*?(react-native|@react-native|@react-native-community|expo|@expo|expo-.*|@expo/.*|react-navigation|@react-navigation|nativewind|react-native-.*|@tanstack|zustand|uuid|@expyrico)))',
  ],
};
