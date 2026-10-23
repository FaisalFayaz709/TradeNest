import { expect, test } from '@playwright/test';

test('a signed-out visitor sees a real buyer authentication gate, not a simulated checkout', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('Order created')).toHaveCount(0);
});

test('mobile navigation exposes accessible state and closes after selecting Search', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 780 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#tradenest-mobile-navigation')).toBeVisible();
  await page.locator('#tradenest-mobile-navigation').getByRole('link', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.locator('#tradenest-mobile-navigation')).toHaveCount(0);
});

test('no admin or seller role controls are offered to a signed-out visitor', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin sign-in required' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Suspend' })).toHaveCount(0);
  await page.goto('/seller');
  await expect(page.getByRole('heading', { name: 'Seller sign-in required' })).toBeVisible();
});

test('the header stays within phone, tablet and desktop viewport widths', async ({ page }) => {
  for (const width of [320, 375, 430, 768, 820, 1024, 1279, 1280, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/');

    const header = page.locator('header').first();
    await expect(header).toBeVisible();
    const overflow = await header.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
    expect(overflow, `Header should not overflow at ${width}px`).toBe(false);

    const menu = page.locator('button[aria-controls="tradenest-mobile-navigation"]');
    if (width < 1280) {
      await expect(menu).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
    } else {
      await expect(menu).toBeHidden();
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    }
  }
});

test('Escape closes the mobile navigation and returns keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const menu = page.locator('button[aria-controls="tradenest-mobile-navigation"]');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
  await expect(page.locator('#tradenest-mobile-navigation')).toHaveCount(0);
});
