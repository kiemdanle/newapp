import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/mock-api.ts'],
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4001',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm exec tsx tests/e2e/mock-api.ts',
      port: 4099,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { MOCK_API_PORT: '4099' },
    },
    {
      command: 'pnpm exec next dev -p 4001',
      port: 4001,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        API_BASE_URL: 'http://localhost:4099',
        COOKIE_SECURE: 'false',
        COOKIE_DOMAIN: '',
      },
    },
  ],
});
