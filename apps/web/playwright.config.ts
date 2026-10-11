import { defineConfig, devices } from '@playwright/test';

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) throw new Error('E2E_DATABASE_URL is required for Playwright workflow tests.');
const sharedPassword = process.env.E2E_SHARED_PASSWORD ?? 'TradeNest-E2E-Only-2026!';
const webhookSecret = process.env.E2E_PAYMENT_WEBHOOK_SECRET ?? 'test-playwright-webhook-secret-at-least-32-characters';
const inheritedEnvironment: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (typeof value === 'string') inheritedEnvironment[key] = value;
}

const apiEnvironment = {
  NODE_ENV: 'test',
  API_HOST: '127.0.0.1',
  API_PORT: '4000',
  DATABASE_URL: databaseUrl,
  JWT_ACCESS_SECRET: 'test-playwright-jwt-secret-at-least-32-characters',
  CATALOG_DEFAULT_CURRENCY: 'USD',
  PAYMENT_PROVIDER: 'sandbox',
  PAYMENT_SANDBOX_WEBHOOK_SECRET: webhookSecret,
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @tradenest/api start:dev',
      url: 'http://127.0.0.1:4000/api/v1/health/ready',
      timeout: 120_000,
      reuseExistingServer: false,
      env: { ...inheritedEnvironment, ...apiEnvironment },
    },
    {
      command: 'pnpm --filter @tradenest/web dev',
      url: 'http://127.0.0.1:3000/api/health',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...inheritedEnvironment,
        TRADENEST_E2E_UI: '1',
        TRADENEST_E2E_API_BASE_URL: 'http://127.0.0.1:4000/api/v1',
        E2E_SHARED_PASSWORD: sharedPassword,
      },
    },
  ],
});
