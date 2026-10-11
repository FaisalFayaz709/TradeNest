import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stripeOperationBlockReason } from '../../apps/api/src/modules/payments/provider/stripe-checkout-core.ts';

const providerSource = readFileSync(fileURLToPath(new URL('../../apps/api/src/modules/payments/provider/stripe-checkout.provider.ts', import.meta.url)), 'utf8');

test('Stripe live money cannot be charged prior to Financial reconciliation', () => {
  assert.equal(stripeOperationBlockReason('sk_live_abc', 'charge'), 'STRIPE_LIVE_MODE_NOT_APPROVED');
  assert.equal(stripeOperationBlockReason('sk_test_abc', 'charge'), null);
});
test('Stripe live refunds remain blocked; test mode requires a durable operation', () => {
  assert.equal(stripeOperationBlockReason('sk_live_abc', 'refund'), 'STRIPE_LIVE_MODE_NOT_APPROVED');
  assert.equal(stripeOperationBlockReason('sk_test_abc', 'refund'), null);
});
test('Stripe adapter allows only outbox-keyed test-mode refund with read-first reconciliation', () => {
  const method = providerSource.split('async refundPayment(')[1]?.split('private classifyRefund(')[0] ?? '';
  assert.match(method, /tradenest-refund-/);
  assert.match(method, /if \(list\.has_more \|\| input\.reconcileOnly\)/);
  assert.match(method, /stripeOperationBlockReason\(cfg\.PAYMENT_STRIPE_SECRET_KEY, 'refund'\)/);
  assert.match(method, /\/v1\/refunds/);
});
test('Stripe adapter checks preapproval before calling the provider', () => {
  const config = providerSource.split('async createPayment(')[1]?.split('async refundPayment(')[0] ?? '';
  assert.match(config, /stripeOperationBlockReason\(cfg\.PAYMENT_STRIPE_SECRET_KEY, 'charge'\)/);
  assert.match(config, /throw new ApiException\(503/);
});
