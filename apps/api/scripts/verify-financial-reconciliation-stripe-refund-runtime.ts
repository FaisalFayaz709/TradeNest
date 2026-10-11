/** Opt-in Stripe TEST MODE refund smoke test. Never runs with live keys. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {StripeCheckoutProvider} from '../src/modules/payments/provider/stripe-checkout.provider.js';
if(process.env.STRIPE_TEST_REFUND_ACK!=='yes') throw new Error('Explicit STRIPE_TEST_REFUND_ACK=yes required');
if(!process.env.PAYMENT_STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Stripe TEST MODE secret required; live mode forbidden');
if(process.env.NODE_ENV==='production') throw new Error('Refusing Stripe refund test under NODE_ENV=production');
for(const key of ['STRIPE_TEST_REFUND_PAYMENT_ID','STRIPE_TEST_REFUND_CHECKOUT_SESSION_ID','STRIPE_TEST_REFUND_AMOUNT','STRIPE_TEST_REFUND_CURRENCY']){
 if(!process.env[key]) throw new Error(`Missing ${key}: use a dedicated paid test checkout payment`);
}
const provider=new StripeCheckoutProvider();
const operationKey=`tradenest-refund-${randomUUID()}`;
const input={paymentId:process.env.STRIPE_TEST_REFUND_PAYMENT_ID!,
 providerPaymentId:process.env.STRIPE_TEST_REFUND_CHECKOUT_SESSION_ID!,
 amount:process.env.STRIPE_TEST_REFUND_AMOUNT!,currency:process.env.STRIPE_TEST_REFUND_CURRENCY!,
 idempotencyKey:operationKey};
const first=await provider.refundPayment(input);
assert.equal(first.provider,'stripe');
assert.ok(first.providerRefundId && ['PENDING','SUCCEEDED'].includes(first.status), 'Stripe refund test did not confirm pending or completed refund');
const replay=await provider.refundPayment({...input,reconcileOnly:true});
assert.equal(replay.providerRefundId,first.providerRefundId,'Reconciliation must locate the SAME provider refund, not issue another');
console.log('FINANCIAL RECONCILIATION STRIPE TEST REFUND SMOKE PASSED (provider request and read-only reconciliation of the same refund).');
