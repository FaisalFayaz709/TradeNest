import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { stripeAmountMinor, stripeAmountMajor, verifiedStripeSignature, trustedStripeCheckoutUrl } from '../../apps/api/src/modules/payments/provider/stripe-checkout-core.ts';

test('integer-only authoritative currency conversion', () => {
  assert.equal(stripeAmountMinor('19.95', 'USD'), 1995);
  assert.equal(stripeAmountMajor(1995, 'USD'), '19.95');
  for (const [money, cur] of [['1.001', 'USD'], ['19.95', 'JPY'], ['19.95', 'KWD'], ['0.00', 'USD'], ['1000000.00', 'USD']]) {
    assert.throws(() => stripeAmountMinor(money, cur));
  }
});

test('Stripe signature validation rejects replay and tampering', () => {
  const payload = Buffer.from('{"id":"evt_test"}');
  const secret = 'whsec_test_key';
  const now = 1791482400;
  const hmac = createHmac('sha256', secret).update(Buffer.concat([Buffer.from(`${now}.`), payload])).digest('hex');
  assert.equal(verifiedStripeSignature(payload, `t=${now},v1=${hmac}`, secret, now), true);
  assert.equal(verifiedStripeSignature(payload, `t=${now},v1=${hmac}`, secret, now + 301), false);
  assert.equal(verifiedStripeSignature(Buffer.from('tampered'), `t=${now},v1=${hmac}`, secret, now), false);
  assert.equal(verifiedStripeSignature(payload, `t=${now},v1=${'0'.repeat(64)}`, secret, now), false);
  assert.equal(verifiedStripeSignature(payload, undefined, secret, now), false);
  assert.equal(verifiedStripeSignature(payload, `t=${now},t=${now},v1=${hmac}`, secret, now), false);
});

test('Checkout URL cannot redirect to attacker-controlled host', () => {
  for (const url of ['https://checkout.stripe.com/c/pay/cs_test', 'https://checkout.stripe.com/']) assert.ok(trustedStripeCheckoutUrl(url));
  for (const url of ['http://checkout.stripe.com/pay', 'https://checkout.stripe.com.evil.test/a',
    'https://stripe.com/checkout', 'https://user@checkout.stripe.com/pay', 'javascript:alert(1)']) assert.equal(trustedStripeCheckoutUrl(url), false);
});
