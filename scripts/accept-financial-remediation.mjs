// Fails closed: static remediations first; existing foundational and payment live acceptance suites
// remain mandatory. This script does not waive any prerequisite or create a lockfile.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
function run(label, bin, args) {
  console.log(`\nFINANCIAL REMEDIATION: ${label}`);
  const result = spawnSync(bin, args, { cwd: root, stdio:'inherit', shell: process.platform === 'win32' });
  if (result.error || result.status !== 0) {
    console.error(`FINANCIAL REMEDIATION NOT ACCEPTED: ${label} failed or prerequisites unavailable.`);
    process.exit(result.status || 1);
  }
}
run('Architecture check', process.execPath, ['scripts/verify-architecture.mjs']);
run('Required API routes', process.execPath, ['scripts/verify-api-contracts.mjs']);
run('Remediation source gate', process.execPath, ['scripts/verify-financial-remediation.mjs']);
run('Remediation regression tests', process.execPath, ['--experimental-strip-types', '--test', 'scripts/tests/financial-remediation-financial-safety.test.mjs', 'scripts/tests/financial-remediation-ui-structure.test.mjs']);
run('Locked toolchain, genuine lockfile and local infrastructure', process.execPath, ['scripts/verify-foundation-environment.mjs']);
run('Frozen installation', 'pnpm', ['install','--frozen-lockfile']);
run('Prisma validation', 'pnpm', ['db:validate']);
run('Workspace typecheck', 'pnpm', ['typecheck']);
run('Workspace lint', 'pnpm', ['lint']);
run('Workspace build', 'pnpm', ['build']);
run('Foundation complete foundation acceptance', 'pnpm', ['acceptance:foundation']);
run('Database live database acceptance', 'pnpm', ['acceptance:database']);
run('Api contracts live API acceptance', 'pnpm', ['acceptance:api-contracts']);
run('Storage live S3 acceptance', 'pnpm', ['acceptance:storage']);
run('Checkout live checkout acceptance', 'pnpm', ['acceptance:checkout']);
run('Payments Stripe TEST-mode acceptance', 'pnpm', ['acceptance:payments']);
console.log('FINANCIAL REMEDIATION automated checks passed; independent Stripe webhook/S3/financial operation evidence and Financial reconciliation reconciliation still required before production approval.');
