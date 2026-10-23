import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const workspace = path.resolve(import.meta.dirname, '../..');
const web = path.join(workspace, 'apps/web');

function tsxFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

const source = (relative) => readFileSync(path.join(web, relative), 'utf8');

test('navigation does not nest button controls inside Next.js Links', () => {
  const broken = [];
  for (const file of [...tsxFiles(path.join(web, 'app')), ...tsxFiles(path.join(web, 'components'))]) {
    const code = readFileSync(file, 'utf8');
    if (/<Link\b[^>]*>\s*<Button\b/.test(code)) broken.push(path.relative(web, file));
  }
  assert.deepEqual(broken, []);
});

test('button-like navigation links use a single anchor via Button asChild', () => {
  const files = [
    'app/cart/page.tsx',
    'app/checkout/page.tsx',
    'app/page.tsx',
    'app/wishlist/page.tsx',
    'components/site-header.tsx',
    'components/buyer-gate.tsx',
    'components/seller-gate.tsx',
    'components/admin-gate.tsx',
  ];
  for (const file of files) {
    assert.match(source(file), /<Button\b[^>]*\basChild\b[^>]*>\s*<Link\b/, file);
  }
});

test('cart checkout action remains an accessible full-width anchor', () => {
  assert.match(
    source('app/cart/page.tsx'),
    /<Button\s+size="lg"\s+className="mt-5 w-full"\s+asChild><Link href="\/checkout">Continue to checkout<\/Link><\/Button>/,
  );
});
