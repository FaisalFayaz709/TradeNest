import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('Explore filters submit supported q and categoryId through a real GET form', () => {
  const toolbar = source('apps/web/components/catalog-toolbar.tsx');
  assert.match(toolbar, /action="\/explore" method="GET" role="search"/);
  assert.match(toolbar, /name="q"/);
  assert.match(toolbar, /name="categoryId"/);
  assert.match(toolbar, /apiData<Category\[]>\('categories'\)/);
  assert.match(toolbar, /<Link href="\/explore"/);
  assert.doesNotMatch(toolbar, /discount|mockResults|fakeProducts|sortBy|priceRange/);
});

test('Explore route gives both URL filters to the catalog and remounts on filter changes', () => {
  const page = source('apps/web/app/explore/explore-query.tsx');
  assert.match(page, /params\.get\('q'\)/);
  assert.match(page, /params\.get\('categoryId'\)/);
  assert.match(page, /<CatalogToolbar key=\{`\$\{query\}:\$\{categoryId\}`\}/);
  assert.match(page, /<CatalogGrid key=\{`\$\{query\}:\$\{categoryId\}`\}/);
  assert.match(page, /showCategoryFilter=\{false\}/);
});

test('Search route uses a direct-link-friendly GET form without stale client query state', () => {
  const search = source('apps/web/app/search/search-client.tsx');
  assert.match(search, /action="\/search" method="GET" role="search"/);
  assert.match(search, /name="q"/);
  assert.match(search, /defaultValue=\{query\}/);
  assert.match(search, /key=\{query\}/);
  assert.match(search, /href="\/explore"/);
  assert.doesNotMatch(search, /setState\(|setValue\(/);
});

test('Category directory is based on actual API data and encodes child category URLs', () => {
  const categories = source('apps/web/app/categories/page.tsx');
  assert.match(categories, /apiData<Category\[]>\('categories'\)/);
  assert.match(categories, /encodeURIComponent\(category\.id\)/);
  assert.match(categories, /encodeURIComponent\(child\.id\)/);
  assert.match(categories, /active = false/);
  assert.match(categories, /<EmptyState/);
  assert.doesNotMatch(categories, /demoCategories|mockCategories|fakeCategories/);
});

test('Product card keeps backend price, catalog stock and non-nested accessible controls', () => {
  const card = source('apps/web/components/product-card.tsx');
  assert.match(card, /formatMoney\(product\.price, product\.currency\)/);
  assert.match(card, /product\.availableQuantity > 0/);
  assert.match(card, /<Image src=\{image\.url\} alt=/);
  assert.match(card, /unoptimized/);
  assert.match(card, /aria-label=\{`Save \$\{product\.name\} to wishlist`\}/);
  assert.match(card, /disabled=\{busy \|\| !inStock\}/);
  assert.match(card, /role="status" aria-live="polite"/);
  assert.doesNotMatch(card, /<Link[^>]*>\s*<button/);
  assert.doesNotMatch(card, /<img\b|mockPrice|fakeRating|salePrice/);
});

test('Cart and wishlist are still gated by buyer role and existing backend routes', () => {
  const card = source('apps/web/components/product-card.tsx');
  assert.match(card, /user\?\.role !== 'BUYER'/);
  assert.match(card, /jsonData\('cart\/items', 'POST', \{ productId: product\.id, quantity: 1 \}\)/);
  assert.match(card, /jsonData\(`wishlist\/\$\{product\.id\}`, 'POST'\)/);
  assert.match(card, /eventType: 'ADD_TO_CART'/);
  assert.match(card, /eventType: 'WISHLIST'/);
  assert.doesNotMatch(card, /createPayment|releaseEscrow|markPaid|ledger/);
});

test('Catalog toolbar and product card support mobile touch targets and keyboard focus', () => {
  const card = source('apps/web/components/product-card.tsx');
  const toolbar = source('apps/web/components/catalog-toolbar.tsx');
  assert.match(card, /min-h-11 w-full/);
  assert.match(card, /focus-visible:outline-2/);
  assert.match(toolbar, /sm:grid-cols-/);
  assert.match(toolbar, /aria-label="Refine marketplace results"/);
  assert.match(toolbar, /min-h-11/);
});


test('Existing catalog grid retains API-backed products, pagination, and UI states', () => {
  const grid = source('apps/web/components/catalog-grid.tsx');
  // Do not assume a particular markup layout: catalog-grid.tsx may carry
  // locally applied hook/lifecycle corrections from the earlier patches.
  assert.match(grid, /apiCollection<Product>/);
  assert.match(grid, /<ProductCard key=\{product\.id\} product=\{product\} \/>/);
  assert.match(grid, /meta\.totalPages/);
  assert.match(grid, /<LoadingState/);
  assert.match(grid, /<EmptyState/);
});
