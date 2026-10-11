/** Source-only tripwires for Financial reconciliation. Live PostgreSQL and Stripe are separate mandatory gates. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const get = p => readFileSync(resolve(root, p),'utf8');
const errors=[];
const requireSource=(path,checks)=>{
  if(!existsSync(resolve(root,path))){errors.push(`Missing ${path}`);return;}
  const src=get(path);
  for(const [name,pattern] of checks) if(!pattern.test(src)) errors.push(`${path}: ${name}`);
};
requireSource('apps/api/prisma/schema.prisma', [
  ['unique escrow obligation', /model RefundOperation[\s\S]*escrowId\s+String\s+@unique/],
  ['money precision', /model RefundOperation[\s\S]*amount\s+Decimal\s+@db.Decimal\(30, 2\)/],
]);
requireSource('apps/api/prisma/migrations/202610080007_durable_refund_operations/migration.sql', [
  ['durable table', /CREATE TABLE "refund_operations"/],
  ['one refund per escrow', /CREATE UNIQUE INDEX "refund_operations_escrow_key"/],
  ['hard status CHECK', /CONSTRAINT "refund_operations_status_check"/],
  ['provider id unique', /CREATE UNIQUE INDEX "refund_operations_provider_refund_key"/],
]);
requireSource('apps/api/src/modules/escrow/escrow.repository.ts', [
  ['no release with unresolved refund obligation', /status: \{ in: \['BUYER_CONFIRMED', 'UNDER_REVIEW'\] \}, refundOperation: \{ is: null \}/],
]);
requireSource('apps/api/src/modules/escrow/refund-operation.repository.ts', [
  ['skip locked leasing', /FOR UPDATE SKIP LOCKED/],
  ['reconciliation state', /status: 'NEEDS_REVIEW'/],
  ['stable unique outbox', /refundOperation.create/],
]);
requireSource('apps/api/src/modules/escrow/refund-reconciliation.service.ts', [
  ['remote request from worker', /this.payments.refundSucceededPayment\(/],
  ['provider confirmed before escrow completion', /result.status === 'SUCCEEDED'[\s\S]*this.finalize\(/],
  ['atomic order/ledger/dispute', /this.escrow.refund\([\s\S]*this.orders.markRefundedFromEscrowRefund[\s\S]*this.disputes.completeRefundAfterProvider/],
  ['operator review on ambiguity', /this.refunds.needsReview/],
]);
requireSource('apps/api/src/modules/payments/payments.service.ts', [
  ['forbid remote call in transaction', /if \(transaction\) throw new ApiException/],
  ['provider-confirmed expiry', /if \(!expired\) return false;/],
]);
requireSource('apps/api/src/modules/payments/provider/stripe-checkout.provider.ts', [
  ['stable operation key required', /tradenest-refund-/],
  ['lookup refunds first', /\/v1\/refunds\?payment_intent/],
  ['read-only after uncertain first attempt', /if \(list.has_more \|\| input.reconcileOnly\)/],
  ['provider expiry request', /\/expire`/],
  ['Stripe live money still forbidden', /stripeOperationBlockReason\(cfg.PAYMENT_STRIPE_SECRET_KEY, 'refund'\)/],
]);
const dispute=get('apps/api/src/modules/disputes/disputes.service.ts');
const refundBranch=dispute.slice(dispute.indexOf("if (input.resolution === 'REFUND_BUYER')"),dispute.indexOf('} else {',dispute.indexOf("if (input.resolution === 'REFUND_BUYER')")));
if(/markRefundedFromEscrowRefund|repository.resolve\(/.test(refundBranch)) errors.push('Dispute refund prematurely finalizes order/dispute before provider result.');
for(const path of ['apps/api/src/modules/escrow/escrow-commands.service.ts','apps/api/src/modules/escrow/escrow.service.ts']){
  const src=get(path); if(src.includes('refundSucceededPayment(')) errors.push(`${path} must never call the provider within a SQL transaction`);
}
if(errors.length){console.error(`FINANCIAL RECONCILIATION SOURCE GATE FAILED (${errors.length})`);errors.forEach(e=>console.error('- '+e));process.exitCode=1;}
else console.log('FINANCIAL RECONCILIATION SOURCE GATE PASSED: durable operation, leasing, no in-tx provider I/O, Stripe read-first reconciliation, verified state transition and expiry boundaries.');
