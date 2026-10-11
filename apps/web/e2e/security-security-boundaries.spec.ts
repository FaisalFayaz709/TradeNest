import { expect, test } from '@playwright/test';

// These requests intentionally use forged Origin headers. They must be denied
// by Next.js before reaching NestJS, irrespective of login state.
test('malicious origin cannot submit a buyer write through the web proxy', async ({ request }) => {
  const response = await request.post('/api/tradenest/cart/items', {
    headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
    data: { productId: '11111111-1111-4111-8111-111111111111', quantity: 1 },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe('WEB_MUTATION_ORIGIN_FORBIDDEN');
});

test('malicious origin cannot create a session or submit login credentials', async ({ request }) => {
  const response = await request.post('/api/session/login', {
    headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
    data: { email: 'someone@example.test', password: 'not-a-real-password' },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe('WEB_MUTATION_ORIGIN_FORBIDDEN');
});

test('safe public GET remains accessible without Origin headers', async ({ request }) => {
  const response = await request.get('/api/tradenest/categories');
  expect(response.status()).not.toBe(403);
});

// Run against isolated Playwright buyer credentials seeded by the E2E fixture.
test('buyer cannot access seller analytics or administrator records', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(process.env.E2E_BUYER_EMAIL ?? 'e2e.buyer@tradenest.invalid');
  await page.getByLabel('Password').fill(process.env.E2E_SHARED_PASSWORD ?? 'TradeNest-E2E-Only-2026!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/explore$/);

  const admin = await page.request.get('/api/tradenest/admin/users');
  expect(admin.status()).toBe(403);
  const seller = await page.request.get('/api/tradenest/seller/analytics');
  expect(seller.status()).toBe(403);

  const moderator = await page.evaluate(async () => {
    const response = await fetch('/api/tradenest/admin/users/11111111-1111-4111-8111-111111111111/suspend', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Unauthorized E2E probe' }),
    });
    return { status: response.status, data: await response.json() };
  });
  expect(moderator.status).toBe(403);
  expect(moderator.data.error.code).not.toBe('WEB_MUTATION_ORIGIN_FORBIDDEN');
});
