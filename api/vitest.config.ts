import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    // env.ts MUST load before setup.ts: setup.ts statically imports db.js/redis.js,
    // whose transitive logger.js eagerly reads config at module-evaluation time. See
    // tests/helpers/env.ts's header comment for the full failure mode this ordering
    // prevents.
    setupFiles: ['./tests/helpers/env.ts', './tests/helpers/setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 15_000,
    env: { NODE_ENV: 'test' },
  },
});
