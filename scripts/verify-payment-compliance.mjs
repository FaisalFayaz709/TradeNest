import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const read=f=>readFileSync(resolve(root,f),'utf8');
const assertions=[
  ['Original architecture checker still available','scripts/verify-architecture.mjs',/modular|NestJS/i],
  ['Durable claim in existing Payments module','apps/api/src/modules/payments/payments.service.ts',/claimOrResume|paymentInitiationClaim|providerInitiationId/],
  ['External provider request after transaction','apps/api/src/modules/payments/payments.service.ts',/const created = await provider\.createPayment\(/],
  ['Atomic payment binding','apps/api/src/modules/payments/payments.service.ts',/transaction|updateMany/],
  ['Same-header claim recovery','apps/api/src/common/idempotency/idempotency.service.ts',/claimOrResume/],
  ['Competing claim guard','apps/api/src/common/idempotency/idempotency.repository.ts',/hasCompetingUnfinishedClaim/],
  ['Live Stripe protection','apps/api/src/modules/payments/provider/stripe-checkout.provider.ts',/stripeOperationBlockReason\(cfg\.PAYMENT_STRIPE_SECRET_KEY, 'charge'\)/],
  ['Deploy accepts test Stripe','scripts/validate-deployment-env.mjs',/\['sandbox', 'stripe'\]/],
  ['Stripe secrets forwarded','docker-compose.deploy.yml',/PAYMENT_STRIPE_WEBHOOK_SECRET:/],
  ['Durable release documentation','docs/deployment-release-gate.md',/Current release status/],
];
const failures=assertions.filter(([label,path,re])=>!existsSync(resolve(root,path))||!re.test(read(path)));
for(const [label] of failures) console.error('FAIL '+label);
if(failures.length)process.exit(1);
console.log(`PAYMENT COMPLIANCE SOURCE GATE: ${assertions.length}/${assertions.length} checks passed (NOT runtime certification).`);
