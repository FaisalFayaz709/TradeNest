/** Fail-closed, cumulative Admin acceptance runner. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..',import.meta.url));
function run(label,command,args) {
  console.log(`\nADMIN: ${label}`);
  const result = spawnSync(command,args,{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
  if(result.error || result.status!==0) { console.error(`ADMIN NOT ACCEPTED: ${label} failed/unavailable`);process.exit(result.status||1); }
}
for(const [label,script] of [
 ['Locked architecture','scripts/verify-architecture.mjs'],
 ['All 74 blueprint routes + approved extensions','scripts/verify-api-contracts.mjs'],
 ['Immutable migration history','scripts/verify-database-migration-chain.mjs'],
 ['Fulfillment fulfillment','scripts/verify-fulfillment.mjs'],
 ['Admin administrative moderation','scripts/verify-admin.mjs'],
]) run(label,process.execPath,[script]);
run('Admin negative regression tests',process.execPath,['--experimental-strip-types','--test','scripts/tests/admin-guards.test.mjs']);
run('Required preceding runtime acceptance',process.execPath,['scripts/accept-fulfillment.mjs']);
run('Prisma validation','pnpm',['db:validate']);
run('Locked-environment typecheck','pnpm',['typecheck']);
run('Backend unit tests','pnpm',['test:api:unit']);
run('Isolated test DB guard',process.execPath,['--experimental-strip-types','scripts/require-fulfillment-test-database.mjs']);
run('NestJS/PostgreSQL moderation runtime test','pnpm',['--filter','@tradenest/api','verify:admin:admin']);
run('Playwright Buyer/Seller/Admin E2E','pnpm',['test:e2e']);
console.log('ADMIN ACCEPTED only if all commands passed in the locked environment.');
