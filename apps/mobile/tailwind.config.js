const { tailwindTokens } = require('./src/theme/tailwind-tokens.cjs');

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: tailwindTokens,
  },
  plugins: [],
};
