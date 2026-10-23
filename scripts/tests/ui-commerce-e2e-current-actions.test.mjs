import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const commerce = readFileSync(new URL('../../apps/web/e2e/commerce-workflows.spec.ts', import.meta.url), 'utf8');
const cart = readFileSync(new URL('../../apps/web/app/cart/page.tsx', import.meta.url), 'utf8');
const checkout = readFileSync(new URL('../../apps/web/app/checkout/page.tsx', import.meta.url), 'utf8');

test('commerce E2E follows the real accessible cart-to-checkout link', () => {
  assert.match(cart, /<Button[^>]*asChild><Link href="\/checkout">Continue to checkout<\/Link><\/Button>/);
  assert.match(commerce, /getByRole\('link', \{ name: 'Continue to checkout' \}\)/);
  assert.doesNotMatch(commerce, /getByRole\('button', \{ name: 'Continue to checkout'/);
  assert.match(commerce, /await expect\(checkoutLink\)\.toBeVisible\(\)/);
});

test('commerce assertions match the live checkout quote and order creation UI', () => {
  assert.match(checkout, /title="Review your order"/);
  assert.match(commerce, /getByRole\('heading', \{ name: 'Review your order' \}\)/);
  assert.match(checkout, /The quote does <strong>not<\/strong> reserve stock/);
  assert.match(commerce, /The quote does not reserve stock/i);
  assert.match(checkout, /Your order has been created/);
  assert.match(commerce, /getByRole\('heading', \{ name: 'Your order has been created' \}\)/);
});

test('payment assertions preserve the real backend-controlled payment workflow', () => {
  assert.match(checkout, /orders\/\$\{created\.order\.id\}\/payments/);
  assert.match(checkout, /hostedCheckoutRedirect\(result\.payment\.provider, result\.checkoutUrl\)/);
  assert.match(checkout, /Continue to payment/);
  assert.match(commerce, /getByRole\('button', \{ name: 'Continue to payment' \}\)/);
  assert.match(checkout, /Provider: \{payment\.provider\} · Reference: \{payment\.providerPaymentId\}/);
  assert.match(commerce, /getByText\(\/Provider:\.\*Reference:\//);
  assert.match(commerce, /succeedSandboxPayment\(completedPurchase\.payment\)/);
});
