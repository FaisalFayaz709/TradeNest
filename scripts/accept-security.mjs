/** Security full release acceptance; never claim completion when prior live gates are unavailable. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
function run(label, command, args) {
  console.log(`\nSECURITY: ${label}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  if (result.error || result.status !== 0) {
    console.error(`SECURITY NOT ACCEPTED: ${label} (${result.error?.message || result.status})`);
    process.exit(result.status || 1);
  }
}
run('Security web security boundary checks', process.execPath, ['scripts/verify-security.mjs']);
run('Security security regression tests', process.execPath, ['--experimental-strip-types', '--test', 'scripts/tests/security-guards.test.mjs']);
run('All cumulative source regressions', process.execPath, ['--experimental-strip-types', '--test', ...[
  'scripts/tests/database-guards.test.mjs', 'scripts/tests/api-contracts-guards.test.mjs',
  'scripts/tests/storage-guards.test.mjs', 'scripts/tests/checkout-guards.test.mjs',
  'scripts/tests/payments-gateway-core.test.mjs', 'scripts/tests/financial-remediation-financial-safety.test.mjs',
  'scripts/tests/financial-remediation-ui-structure.test.mjs', 'scripts/tests/financial-reconciliation-invariants.test.mjs',
  'scripts/tests/fulfillment-invariants.test.mjs', 'scripts/tests/admin-guards.test.mjs',
  'scripts/tests/notifications-notification-guards.test.mjs', 'scripts/tests/seller-intelligence-ai-guards.test.mjs',
  'scripts/tests/frontend-integration.test.mjs', 'scripts/tests/payment-compliance-payment-deployment.test.mjs',
]]);
// Prior live gates are mandatory. This intentionally stops when the authentic
// lockfile, Node 24, PostgreSQL, Stripe test account or S3 bucket is absent.
run('Prior the foundation-through-frontend suitesR live acceptance', process.execPath, ['scripts/accept-payment-compliance.mjs']);
run('NestJS unit tests', 'pnpm', ['test:api:unit']);
run('NestJS PostgreSQL integration tests', 'pnpm', ['test:api:integration']);
run('Complete Playwright buyer/seller/admin workflows including Security security', 'pnpm', ['test:e2e']);
run('FastAPI intelligence tests', 'pnpm', ['test:ai']);
console.log('SECURITY ACCEPTED: all previous and security acceptance gates succeeded.');
