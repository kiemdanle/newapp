// Re-export the plain-JS token map so TypeScript importers get a typed handle
// to the exact same object tailwind.config.js consumes.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { tailwindTokens } = require('./tailwind-tokens.cjs') as {
  tailwindTokens: {
    colors: Record<string, string>;
    borderRadius: Record<string, string>;
  };
};

export { tailwindTokens };
