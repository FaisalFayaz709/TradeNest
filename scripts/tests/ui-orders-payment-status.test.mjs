import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const list = source('apps/web/app/orders/page.tsx');
const detail = source('apps/web/app/orders/[id]/order-detail-client.tsx');
const payments = source('apps/web/app/payments/page.tsx');

// Source regression gates supplement, rather than replace, TypeScript, browser and API tests.
test('buyer orders are paginated through existing backend read models', () => {
  assert.match(list, /apiCollection<OrderSummary>\(`orders\?page=\$\{page\}&limit=\$\{PAGE_LIMIT\}`\)/);
  assert.match(list, /setMeta\(response\.meta\)/);
  assert.match(list, /meta\.totalPages > 1/);
  assert.match(list, /goToPage\(page \+ 1\)/);
  assert.match(list, /goToPage\(page - 1\)/);
  assert.doesNotMatch(list, /orders\?page=1&limit=100/);
});

test('orders loading protects against route changes and supports retries', () => {
  assert.match(list, /let active = true/);
  assert.match(list, /if \(!active\) return/);
  assert.match(list, /return \(\) => \{ active = false; \}/);
  assert.match(list, /setRetryKey\(\(current\) => current \+ 1\)/);
  assert.match(list, /\[page, retryKey\]/);
  assert.doesNotMatch(list, /useEffect\(\(\) => \{\s*setLoading\(true\)/);
});

test('orders list stays responsive and displays backend amounts and order states', () => {
  assert.match(list, /<OrderBadge status=\{order\.status\}/);
  assert.match(list, /formatMoney\(order\.totalAmount, order\.currency\)/);
  assert.match(list, /sm:flex-row sm:items-center sm:justify-between/);
  assert.match(list, /focus-visible:outline-2/);
  assert.match(list, /<BuyerGate><OrdersContent \/><\/BuyerGate>/);
  assert.doesNotMatch(list, /mockOrder|fakeTotal|hardcodedOrders/);
});

test('order detail remounts on route switch and uses a reactive payment query flag', () => {
  assert.match(detail, /<Detail key=\{id\} id=\{id\} \/>/);
  assert.match(detail, /<Suspense fallback=/);
  assert.match(detail, /const searchParams = useSearchParams\(\)/);
  assert.match(detail, /const gatewayReturn = searchParams\.has\('payment'\)/);
  assert.doesNotMatch(detail, /setGatewayReturn/);
  assert.match(detail, /let active = true/);
  assert.match(detail, /if \(active\) applySnapshot/);
});

test('order status refresh reads existing order, escrow and shipment endpoints', () => {
  assert.match(detail, /apiData<Order>\(`orders\/\$\{encodeURIComponent\(id\)\}`\)/);
  assert.match(detail, /apiData<Escrow>\(`orders\/\$\{encodeURIComponent\(id\)\}\/escrow`\)/);
  assert.match(detail, /apiData<Shipment>\(`orders\/\$\{encodeURIComponent\(id\)\}\/shipment`\)/);
  assert.match(detail, /applySnapshot\(await fetchOrderSnapshot\(id\)\)/);
  assert.match(detail, /onClick=\{\(\) => void load\(\)\}/);
});

test('payment and delivery commands still use backend idempotency and prevent duplicate clicks', () => {
  assert.match(detail, /if \(busyRef\.current\) return/);
  assert.match(detail, /busyRef\.current = true/);
  assert.match(detail, /`orders\/\$\{id\}\/confirm-delivery`, 'POST'/);
  assert.match(detail, /'Idempotency-Key': deliveryKey\.current/);
  assert.match(detail, /`orders\/\$\{id\}\/payments`, 'POST'/);
  assert.match(detail, /'Idempotency-Key': paymentKey\.current/);
  assert.match(detail, /hostedCheckoutRedirect\(result\.payment\.provider, result\.checkoutUrl\)/);
  assert.match(detail, /rememberPaymentId\(result\.payment\.id, user\.id\)/);
  assert.match(detail, /if \(checkoutUrl\) window\.location\.assign\(checkoutUrl\)/);
});

test('cancellation, review, dispute evidence and totals keep existing domain workflows', () => {
  assert.match(detail, /`orders\/\$\{id\}\/cancel`, 'POST'/);
  assert.match(detail, /uploadManagedFile\('disputes', dispute\.id, file\)/);
  assert.match(detail, /`orders\/\$\{order\.id\}\/reviews`, 'POST'/);
  assert.match(detail, /`orders\/\$\{orderId\}\/disputes`/);
  assert.match(detail, /formatMoney\(order\.totalAmount, order\.currency\)/);
  assert.doesNotMatch(detail, /mockPayment|markPaid|releaseEscrow|ledgerWrite/);
});

test('gateway returns are explicitly not proof of payment', () => {
  assert.match(detail, /This redirect is not proof of payment/);
  assert.match(detail, /authenticated provider webhook must be verified by the backend/);
  assert.match(detail, /<OrderJourney status=\{order\.status\} \/>/);
  assert.match(detail, /aria-current=\{index === currentIndex \? 'step' : undefined\}/);
  assert.match(detail, /status === 'PENDING_PAYMENT'/);
});

test('payments are isolated per buyer and looked up by exact API ID', () => {
  assert.match(payments, /<PaymentsContent key=\{user\.id\} user=\{user\} \/>/);
  assert.match(payments, /recentPaymentIds\(user\.id\)/);
  assert.match(payments, /apiData<Payment>\(`payments\/\$\{encodeURIComponent\(trimmed\)\}`\)/);
  assert.match(payments, /if \(!trimmed \|\| busyRef\.current\) return/);
  assert.match(payments, /setPayments\(\[\]\)/);
  assert.match(payments, /<BuyerGate><BuyerScopedPayments \/><\/BuyerGate>/);
  assert.doesNotMatch(payments, /useEffect\(\(\) => \{ setRecent/);
});

test('payment detail is readable on phones and does not infer escrow status', () => {
  assert.match(payments, /lg:grid-cols-\[minmax\(260px,340px\)_minmax\(0,1fr\)\]/);
  assert.match(payments, /formatMoney\(payment\.amount, payment\.currency\)/);
  assert.match(payments, /payment\.status === 'SUCCEEDED'/);
  assert.match(payments, /gateway redirect alone does not confirm payment/);
  assert.match(payments, /href=\{`\/orders\/\$\{encodeURIComponent\(payment\.orderId\)\}`\}/);
  assert.doesNotMatch(payments, /setEscrow\(|markPaid|fakeStatus/);
});
