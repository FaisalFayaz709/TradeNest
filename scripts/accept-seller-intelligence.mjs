/** Fail-closed cumulative Seller intelligence acceptance. Static checks are not runtime sign-off. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
function run(label, binary, args) {
  console.log(`\nSELLER INTELLIGENCE: ${label}`);
  const result = spawnSync(binary, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  if (result.error || result.status !== 0) {
    console.error(`SELLER INTELLIGENCE NOT ACCEPTED: ${label} failed or prerequisites unavailable.`);
    process.exit(result.status || 1);
  }
}
for (const [label,script] of [
  ['Locked architecture', 'scripts/verify-architecture.mjs'],
  ['74 API contracts and extensions', 'scripts/verify-api-contracts.mjs'],
  ['Historical migration integrity', 'scripts/verify-database-migration-chain.mjs'],
  ['Notifications / preceding state', 'scripts/verify-notifications.mjs'],
  ['Seller intelligence AI integrity', 'scripts/verify-seller-intelligence-ai.mjs'],
]) run(label, process.execPath, [script]);
run('Seller intelligence fallback / abuse prevention tests', process.execPath,
  ['--experimental-strip-types','--test','scripts/tests/seller-intelligence-ai-guards.test.mjs']);
run('FastAPI AI contract & model tests', 'python', ['-m', 'pytest', '-p', 'no:cacheprovider', '-q', 'services/ai/tests']);
run('Cumulative Notifications runtime acceptance', process.execPath, ['scripts/accept-notifications.mjs']);
run('Prisma schema validation', 'pnpm', ['db:validate']);
run('Complete TypeScript typecheck', 'pnpm', ['typecheck']);
run('NestJS unit tests including Seller intelligence', 'pnpm', ['test:api:unit']);
run('Analytics/behavior-event runtime', 'pnpm', ['--filter', '@tradenest/api', 'verify:behavior-events']);
run('Verified-purchase live PostgreSQL 18 checks', 'pnpm', ['--filter', '@tradenest/api', 'verify:seller-intelligence:ai']);
run('Verified-purchase database integration', 'pnpm', ['test:api:integration']);
run('Recommendation, pricing & fraud runtime', 'pnpm', ['--filter', '@tradenest/api', 'verify:recommendations']);
run('Smart pricing runtime', 'pnpm', ['--filter', '@tradenest/api', 'verify:smart-pricing']);
run('Fraud scoring runtime', 'pnpm', ['--filter', '@tradenest/api', 'verify:fraud-risk']);
run('Seller analytics runtime', 'pnpm', ['--filter', '@tradenest/api', 'verify:seller-analytics']);
run('Buyer/Seller/Admin UI Playwright', 'pnpm', ['test:e2e']);
console.log('SELLER INTELLIGENCE ACCEPTED: all source, live and workflow checks passed.');
