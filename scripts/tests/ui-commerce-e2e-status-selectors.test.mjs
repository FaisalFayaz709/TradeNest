import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const commerce = readFileSync(new URL('../../apps/web/e2e/commerce-workflows.spec.ts', import.meta.url), 'utf8');

test('delivery confirmation still requires the backend response and completed order state', () => {
  assert.match(commerce, /\/confirm-delivery/);
  assert.match(commerce, /expect\(\(await deliveryResponse\)\.ok\(\)\)\.toBeTruthy\(\)/);
  assert.match(commerce, /getByText\('COMPLETED', \{ exact: true \}\)/);
});

test('status assertions tolerate valid duplicate escrow labels from badges and timelines', () => {
  assert.match(commerce, /getByText\('RELEASED', \{ exact: true \}\)\.first\(\)/);
  assert.match(commerce, /getByText\('REFUNDED', \{ exact: true \}\)\.first\(\)/);
  assert.doesNotMatch(commerce, /getByText\('RELEASED', \{ exact: true \}\)\)\.toBeVisible\(/);
  assert.doesNotMatch(commerce, /getByText\('REFUNDED', \{ exact: true \}\)\)\.toBeVisible\(/);
});

test('refund and seller release continue to require successful backend dispute resolutions', () => {
  assert.match(commerce, /admin\/disputes\/\$\{dispute\.id\}\/resolve/);
  assert.match(commerce, /expect\(\(await response\)\.ok\(\)\)\.toBeTruthy\(\)/);
  assert.match(commerce, /resolveDispute\(page, refundDispute, 'Refund buyer'\)/);
  assert.match(commerce, /resolveDispute\(page, releaseDispute, 'Release to seller'\)/);
});
