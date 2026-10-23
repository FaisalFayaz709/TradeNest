import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('homepage prioritizes shopping with a working GET search and buyer routes', () => {
  const page = source('apps/web/app/page.tsx');
  assert.match(page, /<form action="\/search" method="GET" role="search"/);
  assert.match(page, /name="q"/);
  assert.match(page, /href="\/explore"/);
  assert.match(page, /href="\/categories"/);
  assert.match(page, /<CatalogGrid pageSize=\{8\} showCategoryFilter=\{false\} \/>/);
  assert.doesNotMatch(page, /No browser-declared success|Backend-authoritative checkout|Protected transaction states/);
});

test('homepage seller CTA goes to the actual seller workspace, not buyer registration', () => {
  const page = source('apps/web/app/page.tsx');
  assert.match(page, /href="\/seller"/);
  assert.doesNotMatch(page, /href="\/auth\/register"/);
});

test('homepage preview only renders live active in-stock API products', () => {
  const preview = source('apps/web/components/home-market-preview.tsx');
  assert.match(preview, /apiCollection<Product>\('products\?page=1&limit=6'\)/);
  assert.match(preview, /product\.status === 'ACTIVE' && product\.availableQuantity > 0/);
  assert.match(preview, /encodeURIComponent\(product\.slug\)/);
  assert.match(preview, /formatMoney\(product\.price, product\.currency\)/);
  assert.match(preview, /active = false/);
  assert.doesNotMatch(preview, /demoProducts|mockProducts|examplePrice/);
});

test('category links come from real category IDs with safe URL encoding', () => {
  const categories = source('apps/web/components/home-categories.tsx');
  assert.match(categories, /apiData<Category\[]>\('categories'\)/);
  assert.match(categories, /item\.parentId === null/);
  assert.match(categories, /encodeURIComponent\(category\.id\)/);
  assert.match(categories, /active = false/);
  assert.doesNotMatch(categories, /mockCategories|fakeCategories/);
});

test('buyer recommendations reset by session identity and keep AI separate from prices', () => {
  const recommendations = source('apps/web/components/personalized-recommendations.tsx');
  assert.match(recommendations, /user\?\.role !== 'BUYER'/);
  assert.match(recommendations, /<BuyerRecommendations key=\{user\.id\} \/>/);
  assert.match(recommendations, /resolveActiveProducts/);
  assert.match(recommendations, /product\.availableQuantity > 0/);
  assert.doesNotMatch(recommendations, /setProducts\(\[]\);\s*setModelVersion\(''\);/);
});

test('homepage reflows to a single column on phone and contains no checkout-side mutations', () => {
  const page = source('apps/web/app/page.tsx');
  assert.match(page, /lg:grid-cols-\[/);
  assert.match(page, /flex-col gap-2/);
  assert.match(page, /sm:flex-row/);
  assert.doesNotMatch(page, /jsonData|createPayment|createOrder|releaseEscrow/);
});
