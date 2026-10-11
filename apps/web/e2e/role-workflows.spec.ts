import { expect, test } from '@playwright/test';

for (const role of ['BUYER', 'SELLER', 'ADMIN'] as const) {
  test(`${role} workflow crosses the Next.js UI and reaches the correct NestJS policy boundary`, async ({ page }) => {
    await page.goto('/__e2e');
    await page.getByRole('button', { name: `Run ${role} workflow` }).click();
    const result = page.getByTestId(`result-${role}`);
    await expect(result).toBeVisible();
    await expect(result).toContainText(`"role": "${role}"`);
    await expect(page.getByTestId(`error-${role}`)).toHaveCount(0);
  });
}

test('E2E role page identifies itself as a test-only workflow surface', async ({ page }) => {
  await page.goto('/__e2e');
  await expect(page.getByRole('heading', { name: 'Role workflow verification' })).toBeVisible();
  await expect(page.getByText('This route exists only when TRADENEST_E2E_UI=1.')).toBeVisible();
});
