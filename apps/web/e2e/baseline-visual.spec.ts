/**
 * Patch 00: opt-in before-change screenshots for public / Buyer / Seller / Admin.
 * Uses seeded E2E accounts and an isolated local database, never real users.
 * Only discovered by Playwright when TRADENEST_CAPTURE_BASELINE=1.
 * Screenshots are evidence, NOT proof of responsive acceptance or a visual diff.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const output = fileURLToPath(new URL('../../../.tradenest-qa/screenshots/', import.meta.url));
const password = process.env.E2E_SHARED_PASSWORD ?? 'TradeNest-E2E-Only-2026!';
const users = {
  buyer: process.env.E2E_BUYER_EMAIL ?? 'e2e.buyer@tradenest.invalid',
  seller: process.env.E2E_SELLER_EMAIL ?? 'e2e.seller@tradenest.invalid',
  admin: process.env.E2E_ADMIN_EMAIL ?? 'e2e.admin@tradenest.invalid',
} as const;
const viewports = [
  { name: 'phone-375', width: 375, height: 812 },
  { name: 'tablet-820', width: 820, height: 1180 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const;

async function snap(page: Page, route: string, file: string) {
  await page.goto(route);
  await expect(page.locator('main').first()).toBeVisible();
  // Let initial client requests settle when possible; never hang on a polling feed.
  await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {});
  await page.screenshot({ path: join(output, file), fullPage: true, animations: 'disabled' });
}
async function signIn(page: Page, role: keyof typeof users) {
  await page.context().clearCookies();
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(users[role]);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(role === 'buyer' ? /\/explore$/ : role === 'seller' ? /\/seller$/ : /\/admin$/);
}

for (const viewport of viewports) {
  test(`baseline screenshots — ${viewport.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync(output, { recursive: true });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await snap(page, '/', `${viewport.name}-public-home.png`);
    await snap(page, '/explore', `${viewport.name}-public-explore.png`);
    await snap(page, '/auth/login', `${viewport.name}-public-login.png`);

    await signIn(page, 'buyer');
    await snap(page, '/cart', `${viewport.name}-buyer-cart.png`);
    await snap(page, '/orders', `${viewport.name}-buyer-orders.png`);

    await signIn(page, 'seller');
    await snap(page, '/seller', `${viewport.name}-seller-home.png`);
    await snap(page, '/seller/products', `${viewport.name}-seller-products.png`);

    await signIn(page, 'admin');
    await snap(page, '/admin', `${viewport.name}-admin-home.png`);
    await snap(page, '/admin/users', `${viewport.name}-admin-users.png`);
  });
}
