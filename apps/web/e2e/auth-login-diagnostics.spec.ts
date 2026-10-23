import { expect, test } from '@playwright/test';

// A single seeded-buyer login smoke test with safe, actionable failure stages.
// Never log a password, cookie value, access token, or successful auth payload.
test('seeded buyer can authenticate through the real web session', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(process.env.E2E_BUYER_EMAIL ?? 'e2e.buyer@tradenest.invalid');
  await page.getByLabel('Password').fill(process.env.E2E_SHARED_PASSWORD ?? 'TradeNest-E2E-Only-2026!');

  const submit = page.getByRole('button', { name: 'Sign in' });
  await expect(submit).toBeEnabled();

  const loginResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/session/login' && response.request().method() === 'POST',
  );
  await submit.click();
  const response = await loginResponse;
  const payload = (await response.json()) as { error?: { code?: string } };
  expect(response.status(), `Login request failed: HTTP ${response.status()}, code ${payload.error?.code ?? 'unknown'}`).toBe(200);

  const sessionResponse = await page.request.get('/api/session/me');
  const sessionStatus = sessionResponse.status();
  expect(sessionStatus, `Login returned 200 but /api/session/me returned HTTP ${sessionStatus}`).toBe(200);
  await expect(page).toHaveURL(/\/explore$/);
});
