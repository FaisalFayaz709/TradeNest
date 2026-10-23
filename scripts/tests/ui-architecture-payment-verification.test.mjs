import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const verifier = readFileSync(new URL('../verify-architecture.mjs', import.meta.url), 'utf8');
const commerce = readFileSync(new URL('../../apps/web/e2e/commerce-workflows.spec.ts', import.meta.url), 'utf8');

test('architecture checks the backend payment creation and provider-confirmed success, not stale UI copy', () => {
  assert.doesNotMatch(verifier, /Create payment with configured provider/);
  for (const marker of [
    'orders/${checkoutPayload.data.order.id}/payments',
    "response.request().method() === 'POST'",
    'expect(createdPayment.ok()).toBeTruthy()',
    'await succeedSandboxPayment(completedPurchase.payment)',
  ]) {
    assert.ok(verifier.includes(marker), `Architecture verifier lost payment marker: ${marker}`);
    assert.ok(commerce.includes(marker), `Commerce E2E test lost payment marker: ${marker}`);
  }
});

test('architecture still checks delivery, dispute, refund, and seller-release journeys', () => {
  for (const marker of ['Confirm delivery', 'Open dispute', 'Refund buyer', 'Release to seller']) {
    assert.ok(verifier.includes(marker), `Architecture verifier lost commerce marker: ${marker}`);
    assert.ok(commerce.includes(marker), `Commerce E2E test lost commerce marker: ${marker}`);
  }
});
