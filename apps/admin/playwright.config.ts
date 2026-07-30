import { defineConfig } from '@playwright/test';

// Defaults (4001/4099) are for CI, which always runs in a disposable
// container. On a persistent dev box neither port is safe to assume free —
// 4001 in particular can be a live production admin app already bound there.
// An explicit override always forces a *fresh* server (never reuses whatever
// is already listening on the real port) so a misconfigured local run can
// never submit test traffic to it.
const ADMIN_PORT = Number(process.env.ADMIN_E2E_PORT ?? 4001);
const MOCK_PORT = Number(process.env.ADMIN_E2E_MOCK_PORT ?? 4099);
const usingPortOverride = process.env.ADMIN_E2E_PORT !== undefined || process.env.ADMIN_E2E_MOCK_PORT !== undefined;

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/mock-api.ts'],
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${ADMIN_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm exec tsx tests/e2e/mock-api.ts',
      port: MOCK_PORT,
      reuseExistingServer: !process.env.CI && !usingPortOverride,
      timeout: 30_000,
      env: { MOCK_API_PORT: String(MOCK_PORT) },
    },
    {
      command: `pnpm exec next dev -p ${ADMIN_PORT}`,
      port: ADMIN_PORT,
      reuseExistingServer: !process.env.CI && !usingPortOverride,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        API_BASE_URL: `http://localhost:${MOCK_PORT}`,
        COOKIE_SECURE: 'false',
        COOKIE_DOMAIN: '',
      },
    },
  ],
});
