import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    setupFiles: ['./tests/helpers/setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 15_000,
    env: { NODE_ENV: 'test' },
  },
});
