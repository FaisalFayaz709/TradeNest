import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const source = (name) => readFileSync(resolve(root, name), 'utf8');
const proxy = source('apps/web/app/api/tradenest/[...path]/route.ts');

// Independently execute the actual allow-list regexes, not a duplicated reimplementation.
const rulesMatch = proxy.match(/const uuid = [\s\S]+?const rules: RouteRule\[\] = \[[\s\S]+?\n\];/);
assert.ok(rulesMatch, 'The proxy rule list must remain explicit and auditable');
const rulesFunction = new Function(`${rulesMatch[0].replace('const rules: RouteRule[]', 'const rules')}; return (method, path) => rules.some(rule => rule.methods.includes(method) && rule.pattern.test(path));`);
const permitted = rulesFunction();
const id = '11111111-1111-4111-8111-111111111111';
const id2 = '22222222-2222-4222-8222-222222222222';

const expected = [
  ['GET', `products/${id}/images/${id2}/file`],
  ['POST', `products/${id}/images/upload-url`],
  ['POST', `disputes/${id}/evidence/upload-url`],
  ['POST', `products/${id}/images`],
  ['POST', `disputes/${id}/evidence`],
  ['POST', `admin/users/${id}/suspend`],
  ['POST', `admin/users/${id}/reactivate`],
  ['POST', `admin/sellers/${id}/suspend`],
  ['POST', `admin/sellers/${id}/reactivate`],
  ['POST', `admin/products/${id}/suspend`],
  ['POST', `admin/products/${id}/reactivate`],
  ['GET', 'notifications'],
  ['GET', 'notifications/unread-count'],
  ['PATCH', `notifications/${id}/read`],
  ['PATCH', 'notifications/read-all'],
  ['GET', 'seller/analytics/overview'],
  ['GET', `ai/pricing/products/${id}`],
  ['POST', `orders/${id}/payments`],
];

for (const [method, path] of expected) {
  test(`proxy permits established UI action: ${method} ${path}`, () => {
    assert.equal(permitted(method, path), true);
  });
}

for (const [method, path] of [
  ['POST', 'payments/webhooks/stripe'],
  ['POST', 'escrows/1/release'],
  ['GET', 'users'],
  ['DELETE', `admin/users/${id}/suspend`],
  ['GET', `admin/users/${id}/suspend`],
  ['POST', `admin/products/${id}/arbitrary-state`],
  ['POST', 'notifications'],
  ['PATCH', `notifications/${id}/read/else`],
  ['DELETE', 'notifications/read-all'],
  ['POST', `products/${id}/images/${id2}/file`],
  ['GET', 'http://internal.example/auth/me'],
]) {
  test(`proxy rejects unapproved operation: ${method} ${path}`, () => {
    assert.equal(permitted(method, path), false);
  });
}

test('product image streaming is binary and no JSON success envelope is applied', () => {
  assert.match(proxy, /new NextResponse\(image\.body/);
  assert.match(proxy, /Content-Type': image\.headers\.get\('content-type'\)/);
  assert.match(proxy, /X-Content-Type-Options': 'nosniff'/);
  const binaryBranch = proxy.slice(proxy.indexOf('// Public catalog image bytes'), proxy.indexOf('const headers = new Headers();'));
  assert.match(binaryBranch, /apiFetch\(/);
  assert.doesNotMatch(binaryBranch, /authenticatedUpstream|setSessionCookies|authorization/);
});

const { hostedCheckoutRedirect } = await import(pathToFileURL(resolve(root, 'apps/web/lib/hosted-checkout.ts')).href);
test('Stripe test-mode checkout link can be opened only on the genuine Stripe host', () => {
  const target = 'https://checkout.stripe.com/c/pay/cs_test_example?redirect=1';
  assert.equal(hostedCheckoutRedirect('stripe', target), target);
  assert.equal(hostedCheckoutRedirect('sandbox'), null);
});

test('hosted-payment redirect rejects injected origins and malformed links', () => {
  for (const url of [
    'http://checkout.stripe.com/c/pay/abc',
    'https://checkout.stripe.com.evil.example/c/pay/abc',
    'https://fake:password@checkout.stripe.com/c/pay/abc',
    'javascript:alert(1)',
    'https://checkout.stripe.com:444/c/pay/abc',
  ]) assert.throws(() => hostedCheckoutRedirect('stripe', url), /Untrusted payment gateway/);
  assert.throws(() => hostedCheckoutRedirect('stripe'), /did not return a checkout URL/);
});

test('checkout and order screens both consume validated Stripe redirect without granting payment state', () => {
  for (const path of ['apps/web/app/checkout/page.tsx', 'apps/web/app/orders/[id]/order-detail-client.tsx']) {
    const file = source(path);
    assert.match(file, /hostedCheckoutRedirect\(result\.payment\.provider, result\.checkoutUrl\)/);
    assert.match(file, /window\.location\.assign\(checkoutUrl\)/);
    assert.doesNotMatch(file, /Payment = SUCCEEDED|Escrow = HELD/);
  }
});

test('browser payment history is scoped to a buyer, not shared device-wide', () => {
  const client = source('apps/web/lib/api-client.ts');
  const page = source('apps/web/app/payments/page.tsx');
  assert.match(client, /RECENT_PAYMENT_KEY}:\$\{buyerId\}/);
  assert.match(page, /recentPaymentIds\(user\.id\)/);
  assert.match(page, /setPayments\(\[\]\)/);
});

test('product cards prevent duplicate buyer actions and expose accessible feedback', () => {
  const product = source('apps/web/components/product-card.tsx');
  assert.match(product, /if \(busy\) return;/);
  assert.match(product, /disabled=\{busy \|\| product\.availableQuantity < 1\}/);
  assert.match(product, /role="status"/);
});

test('mobile nav has a keyboard-accessible expanded state and branded shell', () => {
  const header = source('apps/web/components/site-header.tsx');
  const css = source('apps/web/app/globals.css');
  assert.match(header, /aria-expanded=\{open\}/);
  assert.match(header, /aria-controls="tradenest-mobile-navigation"/);
  for (const brandColor of ['#0b2a4a', '#0fa3a3', '#d6a84b']) assert.ok(css.includes(brandColor));
});

test('frontend remains Next.js + Tailwind + shadcn-compatible primitives', () => {
  const pkg = JSON.parse(source('apps/web/package.json'));
  assert.match(pkg.dependencies.next, /16/);
  assert.ok(pkg.dependencies['@radix-ui/react-slot']);
  assert.ok(pkg.dependencies['class-variance-authority']);
  assert.ok(pkg.devDependencies.tailwindcss);
  assert.match(source('apps/web/components/ui/button.tsx'), /from '@radix-ui\/react-slot'/);
});
