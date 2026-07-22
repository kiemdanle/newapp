module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: { jsx: true },
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'react-native-a11y', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-native-a11y/all',
  ],
  env: {
    node: true,
    browser: true,
    es2022: true,
    jest: true,
  },
  rules: {
    'react-native-a11y/has-accessibility-hint': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'react-hooks/exhaustive-deps': 'warn',
  },
  ignorePatterns: ['node_modules/', '.expo/', 'stubs/', 'local-packages/', '__tests__/', '*.cjs', '*.js'],
};
