// Mandatory release gate: static checks do not substitute for external integration.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
function run(label,command,args) {
  console.log(`\nPAYMENT COMPLIANCE: ${label}`);
  const result=spawnSync(command,args,{cwd:root,stdio:'inherit',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  if(result.error||result.status!==0){console.error(`PAYMENT COMPLIANCE NOT ACCEPTED: ${label}`);process.exit(result.status||1);}
}
run('Payment compliance source controls',process.execPath,['scripts/verify-payment-compliance.mjs']);
run('Payment compliance executable negative tests',process.execPath,['--test','scripts/tests/payment-compliance-payment-deployment.test.mjs']);
run('Cumulative the foundation-through-frontend suites acceptance',process.execPath,['scripts/accept-frontend.mjs']);
run('Verified payment operations against database','pnpm',['--filter','@tradenest/api','verify:payment-db']);
run('Durable refunds and reconciliation against database','pnpm',['--filter','@tradenest/api','verify:financial-reconciliation:refund-db']);
run('Stripe test-mode payment verification','pnpm',['--filter','@tradenest/api','verify:payments:stripe']);
run('Stripe test-mode refund verification','pnpm',['--filter','@tradenest/api','verify:financial-reconciliation:stripe-refund']);
run('S3 test bucket verification','pnpm',['--filter','@tradenest/api','verify:storage:storage']);
run('Locked deployment preflight',process.execPath,['scripts/deployment-preflight.mjs']);
run('Deployment Compose verification','pnpm',['deploy:config']);
console.log('PAYMENT COMPLIANCE ACCEPTED only if all prior live gates passed.');
