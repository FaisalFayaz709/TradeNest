import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { refundReconcileOnly, refundMayFinalize, refundEligibleToDispatch } from '../../apps/api/src/modules/escrow/refund-policy.ts';
const root=fileURLToPath(new URL('../..',import.meta.url));
const source=(path)=>readFileSync(new URL(path,`file://${root}/`),'utf8');
test('only the first READY operation can create a remote refund',()=>{
  assert.equal(refundReconcileOnly('READY',0),false);
  for (const status of ['IN_FLIGHT','PROVIDER_PENDING','NEEDS_REVIEW','SUCCEEDED']) assert.equal(refundReconcileOnly(status,1),true);
  assert.equal(refundReconcileOnly('READY',1),true);
});
test('terminal escrow states cannot receive another refund ledger entry',()=>{
  assert.equal(refundMayFinalize('HELD','IN_FLIGHT'),true);
  assert.equal(refundMayFinalize('UNDER_REVIEW','IN_FLIGHT'),true);
  for(const status of ['RELEASED','REFUNDED','DISPUTED','SELLER_SHIPPED']) assert.equal(refundMayFinalize(status,'IN_FLIGHT'),false);
  assert.equal(refundMayFinalize('HELD','NEEDS_REVIEW'),false);
});
test('workers only process due operations, with NEEDS_REVIEW restricted to reconciliation',()=>{
  assert.equal(refundEligibleToDispatch('READY',false,false),true);
  assert.equal(refundEligibleToDispatch('IN_FLIGHT',false,false),false);
  assert.equal(refundEligibleToDispatch('IN_FLIGHT',true,false),true);
  assert.equal(refundEligibleToDispatch('PROVIDER_PENDING',false,false),false);
  assert.equal(refundEligibleToDispatch('PROVIDER_PENDING',false,true),true);
  assert.equal(refundEligibleToDispatch('NEEDS_REVIEW',true,false),false);
  assert.equal(refundEligibleToDispatch('NEEDS_REVIEW',true,true),true);
  assert.equal(refundReconcileOnly('NEEDS_REVIEW',2),true);
});
test('provider call happens before, not inside, finalization transaction',()=>{
  const s=source('apps/api/src/modules/escrow/refund-reconciliation.service.ts');
  const sweep=s.slice(s.indexOf('async sweepOnce('),s.indexOf('private async finalize('));
  assert.ok(sweep.indexOf('this.payments.refundSucceededPayment(')<sweep.indexOf('await this.finalize('));
  assert.equal(sweep.includes('this.transactions.runSerializable('),false);
  const final=s.slice(s.indexOf('private async finalize('));
  assert.equal(final.includes('this.payments.refundSucceededPayment('),false);
});
test('refunded ledger and order and dispute share a database transaction',()=>{
  const s=source('apps/api/src/modules/escrow/refund-reconciliation.service.ts');
  const final=s.slice(s.indexOf('private async finalize('));
  for(const call of ['this.escrow.refund(', 'this.orders.markRefundedFromEscrowRefund(', 'this.disputes.completeRefundAfterProvider(', 'this.refunds.succeeded(', 'this.audit.write(']) assert.ok(final.includes(call));
});
test('unpaid Stripe checkout may expire only with provider-confirmed terminal status',()=>{
  const s=source('apps/api/src/modules/payments/provider/stripe-checkout.provider.ts');
  const segment=s.slice(s.indexOf('async expireUnpaidPayment('),s.indexOf('async refundPayment('));
  assert.ok(segment.includes("session.status !== 'open' || session.payment_status !== 'unpaid'"));
  assert.ok(segment.includes("expired.status === 'expired' && expired.payment_status !== 'paid'"));
});
