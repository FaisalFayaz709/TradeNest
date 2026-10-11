import { createHmac, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const password = process.env.E2E_SHARED_PASSWORD ?? 'TradeNest-E2E-Only-2026!';
const webhookSecret = process.env.E2E_PAYMENT_WEBHOOK_SECRET ?? 'test-playwright-webhook-secret-at-least-32-characters';
const accounts = {
  BUYER: process.env.E2E_BUYER_EMAIL ?? 'e2e.buyer@tradenest.invalid',
  SELLER: process.env.E2E_SELLER_EMAIL ?? 'e2e.seller@tradenest.invalid',
  ADMIN: process.env.E2E_ADMIN_EMAIL ?? 'e2e.admin@tradenest.invalid',
} as const;

type ProductPayload = { id: string; slug: string; name: string };
type OrderPayload = { id: string; orderNumber: string; totalAmount: string; currency: string };
type PaymentPayload = { id: string; providerPaymentId: string; amount: string; currency: string };
type DisputePayload = { id: string; orderId: string; status: string };

async function signIn(page: Page, role: keyof typeof accounts) {
  await page.context().clearCookies();
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(accounts[role]);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(role === 'BUYER' ? /\/explore$/ : role === 'SELLER' ? /\/seller$/ : /\/admin$/);
}

async function createSellerProduct(page: Page): Promise<ProductPayload> {
  await signIn(page, 'SELLER');
  await page.goto('/seller/products');
  const suffix = Date.now().toString(36);
  const name = `E2E Protected Item ${suffix}`;
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/tradenest/products')
      && response.request().method() === 'POST'
      && !response.url().includes('/images'),
  );
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('SKU').fill(`E2E-${suffix}`);
  await page.getByLabel('Category').selectOption({ label: 'E2E Category' });
  await page.getByLabel('Price').fill('49.99');
  await page.getByLabel('Opening stock').fill('8');
  await page.getByLabel('Description').fill('Deterministic Playwright product used to exercise the complete TradeNest commerce lifecycle.');
  await page.getByRole('button', { name: 'Create DRAFT' }).click();
  const created = await responsePromise;
  expect(created.ok()).toBeTruthy();
  const payload = (await created.json()) as { data: ProductPayload };

  const productCard = page.getByText(name, { exact: true }).locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  const publishResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/tradenest/products/${payload.data.id}/publish`) && response.request().method() === 'POST',
  );
  await productCard.getByRole('button', { name: 'Publish' }).click();
  expect((await publishResponse).ok()).toBeTruthy();
  await expect(page.getByText(name, { exact: true }).locator('xpath=ancestor::*[contains(@class,"rounded")][1]')).toContainText('ACTIVE');

  await page.goto('/seller/inventory');
  const inventoryRow = page.getByText(name, { exact: true }).locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
  await inventoryRow.getByLabel('Available quantity').fill('8');
  const inventoryResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/tradenest/products/${payload.data.id}/inventory`) && response.request().method() === 'PATCH',
  );
  await inventoryRow.getByRole('button', { name: 'Save' }).click();
  expect((await inventoryResponse).ok()).toBeTruthy();
  await expect(page.getByText(name, { exact: true }).locator('xpath=ancestor::*[contains(@class,"rounded")][1]')).toContainText('current available 8');
  return payload.data;
}

async function ensureBuyerAddress(page: Page) {
  await page.goto('/profile');
  await page.getByPlaceholder('Label (Home, Office)').fill('E2E Home');
  await page.getByPlaceholder('Recipient').fill('E2E Buyer');
  await page.getByPlaceholder('Address line 1').fill('100 Test Avenue');
  await page.getByPlaceholder('City').fill('Test City');
  await page.getByPlaceholder('Region / state').fill('Test Region');
  await page.getByPlaceholder('Postal code').fill('60000');
  await page.getByPlaceholder('2-letter country code').fill('PK');
  const response = page.waitForResponse((candidate) => candidate.url().includes('/api/tradenest/users/me/addresses') && candidate.request().method() === 'POST');
  await page.getByRole('button', { name: 'Add address' }).click();
  expect((await response).ok()).toBeTruthy();
  await expect(page.getByText('100 Test Avenue', { exact: true })).toBeVisible();
}

async function buyProduct(page: Page, product: ProductPayload): Promise<{ order: OrderPayload; payment: PaymentPayload }> {
  await page.goto('/explore');
  await page.getByRole('link', { name: product.name, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: product.name })).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText('Added to cart.')).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByText(product.name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  await expect(page.getByText(/Inventory is .*not reserved/i)).toBeVisible();

  const checkoutResponse = page.waitForResponse((response) => response.url().endsWith('/api/tradenest/checkout') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create order' }).click();
  const checkout = await checkoutResponse;
  expect(checkout.ok()).toBeTruthy();
  const checkoutPayload = (await checkout.json()) as { data: { order: OrderPayload } };
  await expect(page.getByText('Order created')).toBeVisible();

  const paymentResponse = page.waitForResponse((response) => response.url().includes(`/api/tradenest/orders/${checkoutPayload.data.order.id}/payments`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create payment with configured provider' }).click();
  const createdPayment = await paymentResponse;
  expect(createdPayment.ok()).toBeTruthy();
  const paymentPayload = (await createdPayment.json()) as { data: { payment: PaymentPayload } };
  await expect(page.getByText(/Provider payment ID:/)).toBeVisible();
  return { order: checkoutPayload.data.order, payment: paymentPayload.data.payment };
}

async function succeedSandboxPayment(payment: PaymentPayload) {
  const body = JSON.stringify({
    eventId: randomUUID(),
    type: 'PAYMENT_SUCCEEDED',
    providerPaymentId: payment.providerPaymentId,
    amount: payment.amount,
    currency: payment.currency,
    occurredAt: new Date().toISOString(),
  });
  const signature = createHmac('sha256', webhookSecret).update(body).digest('hex');
  const response = await fetch('http://127.0.0.1:4000/api/v1/payments/webhooks/sandbox', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tradenest-signature': `sha256=${signature}` },
    body,
  });
  expect(response.ok).toBeTruthy();
  const payload = await response.json() as { data?: { status?: string } };
  expect(payload.data?.status).toBe('SUCCEEDED');
}

async function shipOrder(page: Page, order: OrderPayload, tracking: string) {
  await signIn(page, 'SELLER');
  await page.goto(`/seller/orders/${order.id}`);
  await expect(page.getByRole('heading', { name: order.orderNumber })).toBeVisible();
  await page.getByLabel('Carrier').fill('TradeNest Test Carrier');
  await page.getByLabel('Tracking code').fill(tracking);
  const response = page.waitForResponse((candidate) => candidate.url().includes(`/api/tradenest/orders/${order.id}/shipment`) && candidate.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create shipment' }).click();
  expect((await response).ok()).toBeTruthy();
  await expect(page.getByText('SHIPPED', { exact: true })).toBeVisible();
}

async function openDispute(page: Page, order: OrderPayload, reason: string): Promise<DisputePayload> {
  await signIn(page, 'BUYER');
  await page.goto(`/orders/${order.id}`);
  await page.getByPlaceholder('Reason').fill(reason);
  await page.getByPlaceholder('Describe the issue…').fill('Playwright dispute evidence path verification for the protected transaction lifecycle.');
  const response = page.waitForResponse((candidate) => candidate.url().includes(`/api/tradenest/orders/${order.id}/disputes`) && candidate.request().method() === 'POST');
  await page.getByRole('button', { name: 'Open dispute' }).click();
  const opened = await response;
  expect(opened.ok()).toBeTruthy();
  const payload = (await opened.json()) as { data: DisputePayload };
  await expect(page.getByRole('heading', { name: 'Dispute opened' })).toBeVisible();
  return payload.data;
}

async function resolveDispute(page: Page, dispute: DisputePayload, action: 'Refund buyer' | 'Release to seller') {
  await signIn(page, 'ADMIN');
  await page.goto(`/admin/disputes/${dispute.id}`);
  await expect(page.getByRole('heading', { name: 'Dispute review' })).toBeVisible();
  const response = page.waitForResponse((candidate) => candidate.url().includes(`/api/tradenest/admin/disputes/${dispute.id}/resolve`) && candidate.request().method() === 'POST');
  await page.getByRole('button', { name: action }).click();
  expect((await response).ok()).toBeTruthy();
  await expect(page.getByText(/Resolution:/)).toBeVisible();
}

test('complete Buyer, Seller, dispute, and Admin hardening journeys through the real Next.js UI', async ({ page }) => {
  test.setTimeout(180_000);

  // Seller: create, publish, and manage inventory through real UI commands.
  const product = await createSellerProduct(page);

  // Buyer: sign in, establish shipping data, browse, cart, checkout, and initiate payment.
  await signIn(page, 'BUYER');
  await ensureBuyerAddress(page);
  const completedPurchase = await buyProduct(page, product);

  // Payment provider: success is injected as an external signed webhook, never by browser state.
  await succeedSandboxPayment(completedPurchase.payment);
  await page.goto(`/orders/${completedPurchase.order.id}`);
  await expect(page.getByText('PAID', { exact: true })).toBeVisible();

  // Seller: receive the paid order and ship it.
  await shipOrder(page, completedPurchase.order, `E2E-${Date.now()}-A`);

  // Buyer: confirm delivery. Backend escrow release completes the order.
  await signIn(page, 'BUYER');
  await page.goto(`/orders/${completedPurchase.order.id}`);
  const deliveryResponse = page.waitForResponse((candidate) => candidate.url().includes(`/api/tradenest/orders/${completedPurchase.order.id}/confirm-delivery`) && candidate.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirm delivery' }).click();
  expect((await deliveryResponse).ok()).toBeTruthy();
  await expect(page.getByText('COMPLETED', { exact: true })).toBeVisible();
  await expect(page.getByText('RELEASED', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Optional review comment').fill('Verified E2E purchase completed successfully.');
  const reviewResponse = page.waitForResponse((candidate) => candidate.url().includes(`/api/tradenest/orders/${completedPurchase.order.id}/reviews`) && candidate.request().method() === 'POST');
  await page.getByRole('button', { name: 'Submit verified-purchase review' }).click();
  expect((await reviewResponse).ok()).toBeTruthy();
  await expect(page.getByText(/Review submitted with rating 5\/5/)).toBeVisible();

  // Seller can observe the authoritative release but cannot mutate it from the seller UI.
  await signIn(page, 'SELLER');
  await page.goto('/seller/escrow');
  await expect(page.getByText(completedPurchase.order.orderNumber, { exact: true })).toBeVisible();
  await expect(page.getByText('RELEASED', { exact: true }).first()).toBeVisible();

  // Dispute branch 1: Buyer disputes a shipped order; Admin reviews and refunds.
  await signIn(page, 'BUYER');
  const refundPurchase = await buyProduct(page, product);
  await succeedSandboxPayment(refundPurchase.payment);
  await shipOrder(page, refundPurchase.order, `E2E-${Date.now()}-B`);
  const refundDispute = await openDispute(page, refundPurchase.order, 'E2E refund branch');
  await resolveDispute(page, refundDispute, 'Refund buyer');
  await signIn(page, 'BUYER');
  await page.goto(`/orders/${refundPurchase.order.id}`);
  await expect(page.getByText('REFUNDED', { exact: true })).toBeVisible();

  // Dispute branch 2: exercise the alternate Admin release resolution.
  const releasePurchase = await buyProduct(page, product);
  await succeedSandboxPayment(releasePurchase.payment);
  await shipOrder(page, releasePurchase.order, `E2E-${Date.now()}-C`);
  const releaseDispute = await openDispute(page, releasePurchase.order, 'E2E release branch');
  await resolveDispute(page, releaseDispute, 'Release to seller');
  await signIn(page, 'BUYER');
  await page.goto(`/orders/${releasePurchase.order.id}`);
  await expect(page.getByText('COMPLETED', { exact: true })).toBeVisible();

  // Admin: operational review surfaces read the authoritative module-owned views.
  await signIn(page, 'ADMIN');
  await page.goto('/admin/users');
  await expect(page.getByText(accounts.BUYER)).toBeVisible();
  await page.goto('/admin/payments');
  await expect(page.getByText('SUCCEEDED', { exact: true }).first()).toBeVisible();
  await page.goto('/admin/escrow');
  await expect(page.getByText(/RELEASED|REFUNDED/).first()).toBeVisible();
  await page.goto('/admin/fraud-alerts');
  await expect(page.getByRole('heading', { name: 'Fraud Alerts' })).toBeVisible();
});
