import { jest } from '@jest/globals';
import { createHmac } from 'node:crypto';
import { StripeCheckoutProvider } from '../../src/modules/payments/provider/stripe-checkout.provider.js';
import { ApiException } from '../../src/common/http/api-exception.js';

const paymentId = '30000000-0000-4000-8000-000000000001';
const orderId = '20000000-0000-4000-8000-000000000001';
const sessionId = 'cs_test_valid123456789';
const original = { ...process.env };
beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/tradenest_test';
  process.env.JWT_ACCESS_SECRET = 'test-very-long-jwt-secret-value-for-unit-testing';
  process.env.CATALOG_DEFAULT_CURRENCY = 'USD';
  process.env.PAYMENT_PROVIDER = 'stripe';
  process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET = 'local-sandbox-secret-at-least-32-chars';
  process.env.PAYMENT_STRIPE_SECRET_KEY = 'sk_test_testingonly12345';
  process.env.PAYMENT_STRIPE_WEBHOOK_SECRET = 'whsec_testingonly12345';
  process.env.PAYMENT_STRIPE_RETURN_ORIGIN = 'https://tradenest.example';
});
afterEach(() => { process.env = { ...original }; jest.restoreAllMocks(); });
function event(type: string, amount = 1995, paymentStatus = 'paid') {
  const rawBody = Buffer.from(JSON.stringify({ id: 'evt_test123', type, created: Math.floor(Date.now() / 1000),
    data: { object: { object: 'checkout.session', id: sessionId, amount_total: amount,
      currency: 'usd', payment_status: paymentStatus } } }));
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', process.env.PAYMENT_STRIPE_WEBHOOK_SECRET!)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody])).digest('hex');
  return { rawBody, headers: { 'stripe-signature': `t=${timestamp},v1=${sig}` } };
}

describe('Stripe Checkout provider — signed terminal events and external requests', () => {
  it('requires actual paid status before emitting successful financial event', () => {
    const provider = new StripeCheckoutProvider();
    expect(provider.verifyWebhook(event('checkout.session.completed', 1995, 'unpaid'))).toBeNull();
    expect(provider.verifyWebhook(event('checkout.session.completed'))).toMatchObject({
      provider: 'stripe', providerPaymentId: sessionId, type: 'PAYMENT_SUCCEEDED', amount: '19.95', currency: 'USD' });
  });
  it('rejects invalid signature before parsing or financial changes', () => {
    const provider = new StripeCheckoutProvider();
    const input = event('checkout.session.completed');
    input.headers['stripe-signature'] = 't=123,v1=' + 'f'.repeat(64);
    expect(() => provider.verifyWebhook(input)).toThrow(ApiException);
  });
  it('ignores unrelated Stripe events without considering them payment success', () => {
    expect(new StripeCheckoutProvider().verifyWebhook(event('payment_intent.succeeded'))).toBeNull();
  });
  it('rejects signed provider amount in unsupported currency or out of range', () => {
    const provider = new StripeCheckoutProvider();
    expect(() => provider.verifyWebhook(event('checkout.session.completed', -1))).toThrow(ApiException);
  });
  it('creates a hosted checkout Session with authoritative amount and stable idempotency', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({
      object: 'checkout.session', id: sessionId, url: 'https://checkout.stripe.com/c/pay/test', amount_total: 1995, currency: 'usd',
    }) } as Response);
    const response = await new StripeCheckoutProvider().createPayment({
      paymentId, orderId, amount: '19.95', currency: 'USD', idempotencyKey: 'client-key',
    });
    expect(response.checkoutUrl).toContain('checkout.stripe.com');
    const options = spy.mock.calls[0][1] as RequestInit;
    expect(new URLSearchParams(options.body as string).get('line_items[0][price_data][unit_amount]')).toBe('1995');
    expect(new URLSearchParams(options.body as string).get('success_url')).toBe(`https://tradenest.example/orders/${orderId}?payment=returned`);
    expect((options.headers as Record<string, string>)['Idempotency-Key']).toBe(`tradenest-session-${paymentId}`);
  });
  it('does not accept untrusted provider redirects', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({
      object: 'checkout.session', id: sessionId, url: 'https://phishing.example/steal', amount_total: 1995, currency: 'usd',
    }) } as Response);
    await expect(new StripeCheckoutProvider().createPayment({ paymentId, orderId,
      amount: '19.95', currency: 'USD', idempotencyKey: 'client-key',
    })).rejects.toThrow(ApiException);
  });
  it('refuses refunds for unverified paid provider sessions', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({
      object: 'checkout.session', id: sessionId, payment_status: 'unpaid', payment_intent: null,
    }) } as Response);
    await expect(new StripeCheckoutProvider().refundPayment({ paymentId, providerPaymentId: sessionId,
      amount: '19.95', currency: 'USD', idempotencyKey: 'refund-1',
    })).rejects.toThrow(ApiException);
  });
});
