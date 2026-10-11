/** Fail-closed Frontend acceptance: source gates never substitute for deployed application tests. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
function run(label, bin, args) {
  console.log(`\nFRONTEND: ${label}`);
  const result = spawnSync(bin, args, {
    cwd: root, stdio: 'inherit', shell: process.platform === 'win32',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  if (result.error || result.status !== 0) {
    console.error(`FRONTEND NOT ACCEPTED: ${label} did not pass (or the required environment is absent).`);
    process.exit(result.status || 1);
  }
}
for (const [label, path] of [
  ['Locked architecture', 'scripts/verify-architecture.mjs'],
  ['Blueprint and extension API route declarations', 'scripts/verify-api-contracts.mjs'],
  ['Historical migrations', 'scripts/verify-database-migration-chain.mjs'],
  ['AI and seller intelligence regressions', 'scripts/verify-seller-intelligence-ai.mjs'],
  ['Frontend buyer/seller/admin frontend source gates', 'scripts/verify-frontend.mjs'],
]) run(label, process.execPath, [path]);
run('Executable frontend routing/security and checkout regression tests', process.execPath,
  ['--experimental-strip-types', '--test', 'scripts/tests/frontend-integration.test.mjs']);
run('Cumulative Seller intelligence acceptance and locked environment', process.execPath, ['scripts/accept-seller-intelligence.mjs']);
run('Next.js TypeScript typecheck', 'pnpm', ['--filter', '@tradenest/web', 'typecheck']);
run('Next.js ESLint', 'pnpm', ['--filter', '@tradenest/web', 'lint']);
run('Next.js 16 production build', 'pnpm', ['--filter', '@tradenest/web', 'build']);
run('Buyer, seller and admin UI Playwright flows', 'pnpm', ['test:e2e']);
console.log('FRONTEND ACCEPTED: all static, runtime, browser and cumulative gates passed.');
