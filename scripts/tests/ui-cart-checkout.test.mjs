import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const cart = source('apps/web/app/cart/page.tsx');
const checkout = source('apps/web/app/checkout/page.tsx');

test('cart loads from the existing API without synchronously setting state inside effects', () => {
  assert.match(cart, /useEffect\(\(\) => \{[\s\S]*?void readCart\(\)/);
  assert.match(cart, /let active = true/);
  assert.match(cart, /if \(!active\) return/);
  assert.match(cart, /return \(\) => \{ active = false; \}/);
  assert.match(cart, /apiData<Cart>\('cart'\)/);
  assert.match(cart, /resolveActiveProducts\(nextCart\.items\.map/);
  assert.doesNotMatch(cart, /useEffect\(\(\) => \{ void load\(\); \}, \[load\]\)/);
});

test('cart mutations keep original backend endpoints and serialize writes', () => {
  assert.match(cart, /jsonData\(`cart\/items\/\$\{itemId\}`, 'PATCH', \{ quantity \}\)/);
  assert.match(cart, /jsonData\(`cart\/items\/\$\{itemId\}`, 'DELETE'\)/);
  assert.match(cart, /jsonData\('cart', 'DELETE'\)/);
  assert.match(cart, /if \(busyRef\.current\) return/);
  assert.match(cart, /busyRef\.current = true/);
  assert.match(cart, /await refreshCart\(\)/);
  assert.match(cart, /busyRef\.current = false/);
  assert.doesNotMatch(cart, /onChange=\{\(event\) => void update\(/);
});

test('cart quantity controls have stock bounds, disabled states and tap targets', () => {
  assert.match(cart, /Number\.isInteger\(quantity\)/);
  assert.match(cart, /quantity > available/);
  assert.match(cart, /aria-label="Decrease quantity"/);
  assert.match(cart, /aria-label="Increase quantity"/);
  assert.match(cart, /item\.quantity <= 1/);
  assert.match(cart, /item\.quantity >= available/);
  assert.match(cart, /disabled=\{disabled \|\| item\.quantity/);
  assert.match(cart, /className="flex size-11 items-center/);
});

test('cart estimates do not replace backend quote or allow unavailable items through', () => {
  assert.match(cart, /formatMoney\(multiplyMoney\(product\.price, item\.quantity\), product\.currency\)/);
  assert.match(cart, /sumMoney\(available\.map/);
  assert.match(cart, /containsUnavailable/);
  assert.match(cart, /!product \|\| product\.status !== 'ACTIVE' \|\| product\.availableQuantity < item\.quantity/);
  assert.match(cart, /estimate && !containsUnavailable/);
  assert.match(cart, /Cart values|This is not your final total|not your final total/i);
  assert.match(cart, /<Link href="\/checkout">Continue to checkout/);
  assert.doesNotMatch(cart, /paymentSuccess|escrowRelease|mockTotal|fakeShipping/);
});

test('cart layout adapts and keeps accessible product information', () => {
  assert.match(cart, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(290px,360px\)\]/);
  assert.match(cart, /sm:grid-cols-\[112px_minmax\(0,1fr\)\]/);
  assert.match(cart, /<Image src=\{image\.url\}/);
  assert.match(cart, /unoptimized/);
  assert.match(cart, /role="group" aria-label=/);
  assert.match(cart, /aria-label="Cart summary"/);
  assert.match(cart, /<BuyerGate><CartContent \/><\/BuyerGate>/);
  assert.doesNotMatch(cart, /<img\b/);
});

test('checkout loads authoritative quote asynchronously with cancellation safety', () => {
  assert.match(checkout, /jsonData<CheckoutQuote>\('checkout\/quote', 'POST'\)/);
  assert.match(checkout, /apiData<Address\[]>\('users\/me\/addresses'\)/);
  assert.match(checkout, /useEffect\(\(\) => \{[\s\S]*?Promise\.all/);
  assert.match(checkout, /let active = true/);
  assert.match(checkout, /if \(!active\) return/);
  assert.match(checkout, /return \(\) => \{ active = false; \}/);
  assert.doesNotMatch(checkout, /useEffect\(\(\) => \{ void load\(\); \}, \[load\]\)/);
});

test('checkout preserves validated addresses, order API and idempotency keys', () => {
  assert.match(checkout, /addresses\.some\(\(address\) => address\.id === addressId\)/);
  assert.match(checkout, /<fieldset className=/);
  assert.match(checkout, /<legend className="sr-only">Select shipping address<\/legend>/);
  assert.match(checkout, /type="radio" name="shippingAddress"/);
  assert.match(checkout, /checkoutKey\.current \|\|= idempotencyKey\('checkout'\)/);
  assert.match(checkout, /'checkout',[\s\S]*?'POST',[\s\S]*?shippingAddressId: addressId/);
  assert.match(checkout, /'Idempotency-Key': checkoutKey\.current/);
  assert.match(checkout, /if \(submitting\.current \|\| created\) return/);
});

test('payment flow still redirects only to configured provider and reports pending status', () => {
  assert.match(checkout, /`orders\/\$\{created\.order\.id\}\/payments`/);
  assert.match(checkout, /'Idempotency-Key': paymentKey\.current/);
  assert.match(checkout, /hostedCheckoutRedirect\(result\.payment\.provider, result\.checkoutUrl\)/);
  assert.match(checkout, /if \(checkoutUrl\) window\.location\.assign\(checkoutUrl\)/);
  assert.match(checkout, /rememberPaymentId\(result\.payment\.id, user\.id\)/);
  assert.match(checkout, /Payment has <strong>not<\/strong> been confirmed/);
  assert.match(checkout, /verified by the backend/);
  assert.doesNotMatch(checkout, /mockPayment|markPaid|releaseEscrow|ledgerWrite|window\.location\.assign\('https:/);
});

test('checkout is mobile responsive and navigation contains no nested actions', () => {
  assert.match(checkout, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(290px,380px\)\]/);
  assert.match(checkout, /sm:grid-cols-2/);
  assert.match(checkout, /lg:sticky lg:top-24/);
  assert.match(checkout, /<Button variant="outline" asChild><Link href="\/cart">/);
  assert.match(checkout, /<BuyerGate><CheckoutContent \/><\/BuyerGate>/);
  assert.match(checkout, /disabled=\{busy \|\| !addressId\}/);
  assert.doesNotMatch(checkout, /<Link[^>]*>\s*<Button/);
});
