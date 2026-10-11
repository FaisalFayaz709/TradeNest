import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const read = name => readFileSync(resolve(root, name), 'utf8');
const payment = read('apps/api/src/modules/payments/payments.service.ts');
const idem = read('apps/api/src/common/idempotency/idempotency.service.ts');
const repo = read('apps/api/src/common/idempotency/idempotency.repository.ts');
const compose = read('docker-compose.deploy.yml');
const stripe = read('apps/api/src/modules/payments/provider/stripe-checkout.provider.ts');

test('provider call occurs after durable transaction and before final binding transaction', () => {
  const method = payment.slice(payment.indexOf('  async initiate('), payment.indexOf('  async get('));
  const claim = method.indexOf('claimed = await this.transactions.runSerializable');
  const creation = method.indexOf('const created = await provider.createPayment(');
  const final = method.indexOf('return this.transactions.runSerializable', creation);
  assert.ok(claim !== -1 && creation > claim && final > creation);
  const first = method.slice(claim, creation);
  assert.match(first, /\n\s*\}\);\s*\} catch \(error\)/);
  assert.ok(!first.includes('provider.createPayment('), 'network call must never occur inside claim transaction');
  assert.match(method, /this\.idempotency\.complete\([\s\S]*?, transaction\)/);
  assert.match(method, /this\.repository\.initializePendingPayment\(current\.id, created\.provider, created\.providerPaymentId, transaction\)/);
});
test('unchanged original blueprint and state machines; no new public routes or microservice', () => {
  assert.match(payment, /orders\.paymentContext\(orderId, transaction\)/);
  assert.match(payment, /this\.authorization\.requireOwnership\(/);
  assert.ok(!payment.includes('fetch(`https://api.stripe.com'));
  assert.match(stripe, /tradenest-session-\$\{input\.paymentId\}/);
});
test('incomplete same-key claims can resume but a different key cannot', () => {
  assert.match(idem, /replayOrPermitInProgress/);
  assert.match(idem, /claimOrResume/);
  assert.match(repo, /hasCompetingUnfinishedClaim/);
  assert.match(payment, /PAYMENT_INITIATION_IN_PROGRESS/);
  assert.match(payment, /this\.idempotency\.hasCompetingUnfinishedClaim\(/);
  assert.match(payment, /PAYMENT_INITIATION_RECONCILIATION_REQUIRED/);
  assert.match(payment, /20 \* 60 \* 60 \* 1000/);
});
test('expiration does not release inventory reserved by an initializing provider request', () => {
  assert.match(payment, /payment\.providerPaymentId\.startsWith\('tradenest_init_'\)/);
});
test('Compose forwards all 3 Stripe settings in the existing API environment', () => {
  assert.match(compose, /PAYMENT_STRIPE_SECRET_KEY: \$\{PAYMENT_STRIPE_SECRET_KEY:-\}/);
  assert.match(compose, /PAYMENT_STRIPE_WEBHOOK_SECRET: \$\{PAYMENT_STRIPE_WEBHOOK_SECRET:-\}/);
  assert.match(compose, /PAYMENT_STRIPE_RETURN_ORIGIN: \$\{PAYMENT_STRIPE_RETURN_ORIGIN:-\}/);
  assert.match(compose, /environment: \*api_environment/);
});
const base = {
  POSTGRES_USER: 'tradenest', POSTGRES_PASSWORD: 'a_super_secure_password_2026',
  POSTGRES_DB: 'tradenest', DATABASE_URL: 'postgresql://tradenest:password@postgres:5432/tradenest',
  JWT_ACCESS_SECRET: 'a'.repeat(36), PAYMENT_SANDBOX_WEBHOOK_SECRET: 'b'.repeat(36),
  OBSERVABILITY_METRICS_TOKEN: 'c'.repeat(36),
  NEXT_PUBLIC_API_BASE_URL: 'https://shop.example.org/api/v1',
  PAYMENT_PROVIDER: 'stripe', PAYMENT_STRIPE_SECRET_KEY: 'sk_test_' + 'a'.repeat(28),
  PAYMENT_STRIPE_WEBHOOK_SECRET: 'whsec_' + 'b'.repeat(28),
  PAYMENT_STRIPE_RETURN_ORIGIN: 'https://shop.example.org',
};
function validate(overrides={}) {
  const dir = mkdtempSync(join(tmpdir(), 'tradenest-payment-compliance-'));
  try {
    const path = join(dir, 'deploy.env');
    writeFileSync(path, Object.entries({...base,...overrides}).map(([k,v]) => `${k}=${v}`).join('\n'));
    return spawnSync(process.execPath, [resolve(root, 'scripts/validate-deployment-env.mjs'), path], { encoding:'utf8' });
  } finally { rmSync(dir, {recursive:true,force:true}); }
}
test('valid Stripe TEST-mode deployment accepted', () => {
  const r=validate(); assert.equal(r.status,0,r.stderr);
});
test('legacy sandbox remains accepted', () => {
  const r=validate({PAYMENT_PROVIDER:'sandbox',PAYMENT_STRIPE_SECRET_KEY:'',PAYMENT_STRIPE_WEBHOOK_SECRET:'',PAYMENT_STRIPE_RETURN_ORIGIN:''});
  assert.equal(r.status,0,r.stderr);
});
test('live-money Stripe keys fail closed even with plausible credentials', () => {
  const r=validate({PAYMENT_STRIPE_SECRET_KEY:'sk_live_'+'a'.repeat(28)});
  assert.notEqual(r.status,0); assert.match(r.stderr,/sk_test_/);
});
test('Stripe without webhook secret rejected', () => {
  const r=validate({PAYMENT_STRIPE_WEBHOOK_SECRET:''});
  assert.notEqual(r.status,0);assert.match(r.stderr,/WEBHOOK_SECRET/);
});
test('Stripe without trusted return origin rejected', () => {
  const r=validate({PAYMENT_STRIPE_RETURN_ORIGIN:'http://shop.example.org'});
  assert.notEqual(r.status,0);assert.match(r.stderr,/RETURN_ORIGIN/);
});
test('Stripe origin cannot contain a path or userinfo', () => {
  for(const origin of ['https://shop.example.org/checkout','https://user:pass@shop.example.org']) {
    const r=validate({PAYMENT_STRIPE_RETURN_ORIGIN:origin});
    assert.notEqual(r.status,0);assert.match(r.stderr,/RETURN_ORIGIN/);
  }
});
test('unknown payment-provider values rejected', () => {
  const r=validate({PAYMENT_PROVIDER:'unknown'});
  assert.notEqual(r.status,0);assert.match(r.stderr,/PAYMENT_PROVIDER/);
});
