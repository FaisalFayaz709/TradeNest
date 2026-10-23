import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const detail = source('apps/web/app/products/[slug]/product-detail-client.tsx');
const gallery = source('apps/web/components/product-gallery.tsx');

test('gallery uses real sorted API images, primary preference and a resilient placeholder', () => {
  assert.match(gallery, /import Image from 'next\/image'/);
  assert.match(gallery, /\.sort\(\(a, b\) => a\.sortOrder - b\.sortOrder\)/);
  assert.match(gallery, /sortedImages\.find\(\(image\) => image\.isPrimary\)/);
  assert.match(gallery, /selected\?\.id === image\.id/);
  assert.match(gallery, /Photos coming soon/);
  assert.doesNotMatch(gallery, /<img\b|fake|mock/);
});

test('gallery thumbnails are keyboard-accessible and display selected image', () => {
  assert.match(gallery, /<button[\s\S]*type="button"/);
  assert.match(gallery, /aria-pressed=\{selected\?\.id === image\.id\}/);
  assert.match(gallery, /onClick=\{\(\) => setSelectedId\(image\.id\)\}/);
  assert.match(gallery, /aria-label=\{`Show photo/);
  assert.match(gallery, /overflow-x-auto/);
  assert.match(gallery, /focus-visible:outline-2/);
  assert.match(gallery, /<Image[\s\S]*unoptimized/);
  assert.match(gallery, /object-contain/);
});

test('route switch resets product gallery, quantity and requests', () => {
  assert.match(detail, /return <ProductDetailContent key=\{slug\} slug=\{slug\} \/>/);
  assert.match(detail, /let active = true/);
  assert.match(detail, /return \(\) => \{ active = false; \}/);
  assert.match(detail, /if \(!active\) return/);
  assert.match(detail, /if \(active\) setReviews/);
  assert.match(detail, /if \(active\) setSimilar/);
});

test('initial product loading is asynchronous and does not synchronously set state in effect', () => {
  const effect = detail.match(/useEffect\(\(\) => \{[\s\S]+?\}, \[slug\]\)/)?.[0];
  assert.ok(effect);
  assert.match(effect, /await apiData<Product>\(`products\/\$\{encodeURIComponent\(slug\)\}`\)/);
  assert.doesNotMatch(effect, /setLoading\(true\)|setError\(null\)/);
  assert.match(effect, /setLoading\(false\)/);
  assert.match(detail, /<LoadingState label="Loading product…"/);
  assert.match(detail, /<ErrorNotice message=\{error \|\| 'Product not found\.'/);
});

test('quantity selector clamps to catalog stock and respects out-of-stock listings', () => {
  assert.match(detail, /product\.status === 'ACTIVE' && available > 0/);
  assert.match(detail, /Math\.max\(1, Math\.min\(available \|\| 1, Math\.trunc\(value\) \|\| 1\)\)/);
  assert.match(detail, /aria-label="Decrease quantity"/);
  assert.match(detail, /aria-label="Increase quantity"/);
  assert.match(detail, /id="product-quantity" type="number"/);
  assert.match(detail, /quantity >= available/);
  assert.match(detail, /disabled=\{!canPurchase \|\| busy !== null\}/);
});

test('cart and wishlist keep backend-controlled endpoints and buyer role gate', () => {
  assert.match(detail, /user\?\.role !== 'BUYER'/);
  assert.match(detail, /jsonData\('cart\/items', 'POST', \{ productId: product\.id, quantity \}\)/);
  assert.match(detail, /jsonData\(`wishlist\/\$\{product\.id\}`, 'POST'\)/);
  assert.match(detail, /setBusy\('cart'\)/);
  assert.match(detail, /setBusy\('wishlist'\)/);
  assert.match(detail, /role="status" aria-live="polite"/);
  assert.doesNotMatch(detail, /createPayment|releaseEscrow|markPaid|ledger|mockPrice|fakeDiscount/);
});

test('product page uses backend price, real ratings and actual AI recommendations', () => {
  assert.match(detail, /formatMoney\(product\.price, product\.currency\)/);
  assert.match(detail, /apiCollection<Review>\(`products\/\$\{value\.id\}\/reviews\?page=1&limit=20`\)/);
  assert.match(detail, /ai\/recommendations\/products\/\$\{value\.id\}\?limit=4/);
  assert.match(detail, /resolveActiveProducts\(/);
  assert.match(detail, /reviewsFailed \?/);
  assert.match(detail, /Reviews are unavailable right now/);
  assert.match(detail, /<ProductCard key=\{candidate\.id\} product=\{candidate\} \/>/);
});

test('product purchase actions and gallery fit narrow screens', () => {
  assert.match(detail, /lg:grid-cols-\[minmax\(0,1\.08fr\)_minmax\(0,0\.92fr\)\]/);
  assert.match(detail, /sm:flex-row sm:items-end/);
  assert.match(detail, /sm:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(detail, /<Button size="lg" className="w-full"/);
  assert.match(gallery, /aspect-\[4\/3\]/);
  assert.match(detail, /aria-label="Breadcrumb"/);
});
