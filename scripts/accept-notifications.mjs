/** Fail-closed cumulative Notifications acceptance. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
function run(label,command,args){
 console.log(`\nNOTIFICATIONS: ${label}`);
 const result=spawnSync(command,args,{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
 if(result.error||result.status!==0){console.error(`NOTIFICATIONS NOT ACCEPTED: ${label} failed/unavailable`);process.exit(result.status||1);}
}
for(const [label,script] of [
 ['Locked architecture','scripts/verify-architecture.mjs'],
 ['Required routes and extensions','scripts/verify-api-contracts.mjs'],
 ['Historical migration baseline','scripts/verify-database-migration-chain.mjs'],
 ['Financial reconciliation finance','scripts/verify-financial-reconciliation.mjs'],
 ['Admin moderation','scripts/verify-admin.mjs'],
 ['Notifications notifications','scripts/verify-notifications.mjs'],
 ])run(label,process.execPath,[script]);
run('Notifications negative regression tests',process.execPath,['--test','scripts/tests/notifications-notification-guards.test.mjs']);
run('Complete earlier-pass acceptance',process.execPath,['scripts/accept-admin.mjs']);
run('Prisma schema validation','pnpm',['db:validate']);
run('Locked-environment typecheck','pnpm',['typecheck']);
run('NestJS unit tests','pnpm',['test:api:unit']);
run('Live localhost-only PostgreSQL 18 notifications','pnpm',['--filter','@tradenest/api','verify:notifications:notifications']);
run('Playwright buyer/seller/admin','pnpm',['test:e2e']);
console.log('NOTIFICATIONS ACCEPTED only if all source, runtime and workflow checks passed.');
