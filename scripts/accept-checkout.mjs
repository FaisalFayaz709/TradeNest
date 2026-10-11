/** Fail-closed acceptance: database, checkout, payments and architecture. */
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
function step(label,command,args){
 console.log(`\nCHECKOUT: ${label}`);
 const result=spawnSync(command,args,{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
 if(result.error||result.status!==0){console.error(`CHECKOUT BLOCKED: ${label}. No live sign-off.`);process.exit(result.status||1);}
}
step('source invariant checks',process.execPath,[resolve(root,'scripts/verify-checkout.mjs')]);
step('negative-regression checks',process.execPath,['--test',resolve(root,'scripts/tests/checkout-guards.test.mjs')]);
step('verify dedicated localhost test database',process.execPath,[resolve(root,'scripts/verify-database-target.mjs')]);
if(!process.env.TEST_DATABASE_URL||process.env.DATABASE_URL!==process.env.TEST_DATABASE_URL){console.error('CHECKOUT: DATABASE_URL must equal TEST_DATABASE_URL');process.exit(1);}
step('locked runtime + genuine pnpm-lock.yaml',process.execPath,[resolve(root,'scripts/verify-foundation-environment.mjs')]);
step('frozen workspace installation','pnpm',['install','--frozen-lockfile']);
step('build locked shared packages','pnpm',['--filter','@tradenest/config','build']);
step('build shared Zod contracts','pnpm',['--filter','@tradenest/contracts','build']);
step('apply additive migrations in isolated DB','pnpm',['db:migrate:deploy']);
step('Prisma validation and client generation','pnpm',['db:validate']);
step('Prisma client generation','pnpm',['db:generate']);
step('prior checkout, inventory and payment regression tests','pnpm',['--filter','@tradenest/api','verify:checkout-transaction']);
step('prior single-seller policy test','pnpm',['--filter','@tradenest/api','verify:single-seller-checkout']);
step('prior payment database regression','pnpm',['--filter','@tradenest/api','verify:payment-db']);
step('Checkout NestJS unit tests','pnpm',['test:api:unit']);
step('Checkout live expiration / inventory race tests','pnpm',['--filter','@tradenest/api','verify:checkout:expiration']);
step('full architecture lock', 'pnpm',['verify:architecture']);
console.log('CHECKOUT ACCEPTED after locked live database and application checks.');
