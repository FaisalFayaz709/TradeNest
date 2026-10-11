/** Fail-closed Financial reconciliation acceptance: does not waive the foundational and payment suites or any live gate. */
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
function run(name,bin,args){
 console.log(`\nFINANCIAL RECONCILIATION: ${name}`);
 const result=spawnSync(bin,args,{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
 if(result.error || result.status!==0){console.error(`FINANCIAL RECONCILIATION NOT ACCEPTED: ${name} missing/failed.`);process.exit(result.status||1);}
}
run('Architecture invariants',process.execPath,['scripts/verify-architecture.mjs']);
run('74 blueprint API route declarations',process.execPath,['scripts/verify-api-contracts.mjs']);
run('Database migration chain',process.execPath,['scripts/verify-database-migration-chain.mjs']);
run('Financial reconciliation financial source checks',process.execPath,['scripts/verify-financial-reconciliation.mjs']);
run('Financial reconciliation isolated invariants',process.execPath,['--experimental-strip-types','--test','scripts/tests/financial-reconciliation-invariants.test.mjs']);
run('the foundational and payment suites locked runtime acceptance',process.execPath,['scripts/accept-financial-remediation.mjs']);
run('Verify new Prisma model and migration','pnpm',['db:validate']);
run('Generate new Prisma client','pnpm',['db:generate']);
run('Full workspace TypeScript typecheck','pnpm',['typecheck']);
run('Full backend financial unit tests','pnpm',['test:api:unit']);
run('Financial reconciliation PostgreSQL 18 refund constraint tests','pnpm',['--filter','@tradenest/api','verify:financial-reconciliation:refund-db']);
run('Financial reconciliation Stripe TEST MODE refund and idempotent reconciliation','pnpm',['--filter','@tradenest/api','verify:financial-reconciliation:stripe-refund']);
console.log('FINANCIAL RECONCILIATION AUTOMATION PASSED. Production release still requires legal fund custody/settlement, payment provider approval and separate operational disaster-recovery acceptance.');
