import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const api = readFileSync(new URL('../../apps/api/src/modules/escrow/refund-reconciliation.service.ts', import.meta.url), 'utf8');
const config = readFileSync(new URL('../../apps/web/playwright.config.ts', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../../apps/web/app/admin/disputes/[id]/page.tsx', import.meta.url), 'utf8');
const commerce = readFileSync(new URL('../../apps/web/e2e/commerce-workflows.spec.ts', import.meta.url), 'utf8');

test('refund worker stays disabled in ordinary test processes', () => {
  assert.match(api, /NODE_ENV === 'test' && !this\.isIsolatedSandboxE2E\(\)/);
  assert.match(api, /REFUND_RECONCILIATION_ENABLED === 'false'/);
  assert.match(api, /TRADENEST_E2E_REFUND_WORKER !== '1'/);
  assert.match(api, /PAYMENT_PROVIDER !== 'sandbox'/);
  assert.match(api, /databaseUrl !== process\.env\.E2E_DATABASE_URL/);
  assert.match(api, /parsed\.hostname === '127\.0\.0\.1'/);
  assert.match(api, /\(e2e\|test\)/);
  assert.match(config, /TRADENEST_E2E_REFUND_WORKER: '1'/);
});

test('admin UI does not claim an unconfirmed refund is resolved', () => {
  assert.match(ui, /PENDING_PROVIDER_CONFIRMATION/);
  assert.match(ui, /Awaiting payment provider confirmation/);
  assert.match(ui, /dispute\.status === 'OPEN' && refundPending/);
  assert.match(ui, /Idempotency-Key/);
});

test('browser acceptance waits for real reconciled refund, then checks final UI', () => {
  assert.match(commerce, /expect\(outcome\.data\.status\)\.toBe\('OPEN'\)/);
  assert.match(commerce, /expect\.poll\(async \(\) =>/);
  assert.match(commerce, /RESOLVED:REFUND_BUYER/);
  assert.match(commerce, /expect\(outcome\.meta\?\.financialOutcome\)\.toBe\('FINALIZED'\)/);
  assert.match(commerce, /Resolution: RELEASE TO SELLER/);
});
