// Fail closed: static tests first; live Stripe test-mode and locked database environment required for sign-off.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
function step(label, command, args) {
  console.log(`\nPAYMENTS: ${label}`);
  const result = spawnSync(command, args, { cwd:root, stdio:'inherit', shell:process.platform==='win32' });
  if(result.error || result.status !== 0){ console.error(`PAYMENTS BLOCKED: ${label}. No live sign-off.`);process.exit(result.status || 1); }
}
step('Architecture lock',process.execPath,[resolve(root,'scripts/verify-architecture.mjs')]);
step('Blueprint API routes',process.execPath,[resolve(root,'scripts/verify-api-contracts.mjs')]);
step('Payments payment gateway source checks',process.execPath,[resolve(root,'scripts/verify-payments.mjs')]);
step('Payments standalone adversarial tests',process.execPath,['--experimental-strip-types','--test',resolve(root,'scripts/tests/payments-gateway-core.test.mjs')]);
step('Database target guard',process.execPath,[resolve(root,'scripts/verify-database-target.mjs')]);
if(!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL){console.error('PAYMENTS: DATABASE_URL must equal TEST_DATABASE_URL');process.exit(1);}
step('Locked Node 24 + dependency lockfile',process.execPath,[resolve(root,'scripts/verify-foundation-environment.mjs')]);
step('Frozen dependencies','pnpm',['install','--frozen-lockfile']);
step('Prisma schema check','pnpm',['db:validate']);
step('Build','pnpm',['build']);
step('Typecheck','pnpm',['typecheck']);
step('Backend unit tests including Stripe HTTP mocks','pnpm',['test:api:unit']);
step('Payment database integration tests','pnpm',['--filter','@tradenest/api','verify:payment-db']);
if(process.env.PAYMENT_PROVIDER !== 'stripe' || !process.env.PAYMENT_STRIPE_SECRET_KEY?.startsWith('sk_test_') || !process.env.PAYMENT_STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) {
  console.error('PAYMENTS: Stripe test-mode configuration is required for live adapter acceptance (never use live keys).');process.exit(1);
}
step('Live Stripe test-mode Checkout API idempotency smoke test','pnpm',['--filter','@tradenest/api','verify:payments:stripe']);
console.log('PAYMENTS automated checks passed. Real webhook delivery, payment confirmation and reconciliation remain manual acceptance requirements.');
