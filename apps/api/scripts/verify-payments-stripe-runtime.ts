/** Safe test-mode checkout-only smoke test. Does not capture funds or use production keys. */
import { randomUUID } from 'node:crypto';
import { parseApiEnvironment } from '@tradenest/config';
import { StripeCheckoutProvider } from '../src/modules/payments/provider/stripe-checkout.provider.js';
const config = parseApiEnvironment(process.env);
if (config.PAYMENT_PROVIDER !== 'stripe' || !config.PAYMENT_STRIPE_SECRET_KEY?.startsWith('sk_test_') ||
  !config.PAYMENT_STRIPE_RETURN_ORIGIN || process.env.NODE_ENV === 'production') {
  throw new Error('Requires PAYMENT_PROVIDER=stripe, sk_test_ key, HTTPS return origin, non-production environment.');
}
const provider = new StripeCheckoutProvider();
const paymentId = randomUUID();
const data = { paymentId, orderId: randomUUID(), amount: '19.95', currency: 'USD', idempotencyKey: randomUUID() };
const first = await provider.createPayment(data);
const retry = await provider.createPayment(data);
if (!first.checkoutUrl?.startsWith('https://checkout.stripe.com/') ||
  first.providerPaymentId !== retry.providerPaymentId || first.checkoutUrl !== retry.checkoutUrl) {
  throw new Error('STRIPE_TEST_MODE_CHECKOUT_IDEMPOTENCY_FAILED');
}
console.log('Payments test-mode checkout API passed: provider returned the same session/URL on retry.');
console.log('This does NOT certify webhook delivery, money transfer, refund reconciliation or settlement.');
