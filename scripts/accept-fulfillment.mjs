/** Fulfillment acceptance is cumulative and fails closed on missing the foundational and financial suites. */
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
function run(name,command,args){
  console.log(`\nFULFILLMENT: ${name}`);
  const result=spawnSync(command,args,{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
  if(result.error || result.status!==0){console.error(`FULFILLMENT NOT ACCEPTED: ${name} unavailable/failed.`);process.exit(result.status||1);}
}
for(const [name,script] of [
 ['Architecture invariant','scripts/verify-architecture.mjs'],
 ['All 74 blueprint endpoints','scripts/verify-api-contracts.mjs'],
 ['Historical migration chain','scripts/verify-database-migration-chain.mjs'],
 ['Financial reconciliation financial workflow','scripts/verify-financial-reconciliation.mjs'],
 ['Fulfillment fulfillment','scripts/verify-fulfillment.mjs'],
]) run(name,process.execPath,[script]);
run('Fulfillment isolated regression tests',process.execPath,['--experimental-strip-types','--test','scripts/tests/fulfillment-invariants.test.mjs']);
run('Cumulative Foundation-7 runtime acceptance',process.execPath,['scripts/accept-financial-reconciliation.mjs']);
run('Prisma 7 schema validation','pnpm',['db:validate']);
run('Guard: local isolated test DB only',process.execPath,['--experimental-strip-types','scripts/require-fulfillment-test-database.mjs']);
run('Apply additive migration to test DB','pnpm',['db:migrate:deploy']);
run('Prisma Client generation','pnpm',['db:generate']);
run('Full workspace TypeScript typecheck','pnpm',['typecheck']);
run('Full backend unit tests','pnpm',['test:api:unit']);
for(const script of ['verify:shipping','verify:shipping-db','verify:delivery-confirmation','verify:delivery-confirmation-db','verify:cancellation-refund','verify:cancellation-refund-db','verify:disputes','verify:disputes-db','verify:reviews','verify:reviews-db','verify:fulfillment:fulfillment-db'])
  run(script,'pnpm',['--filter','@tradenest/api',script]);
run('Buyer/Seller/Admin E2E flows','pnpm',['test:e2e']);
console.log('FULFILLMENT ACCEPTED in configured environment. Other remaining blueprint modules still require passes 9-14.');
