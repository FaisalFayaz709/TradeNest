import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const source = (name) => readFileSync(path.join(root, 'apps/web/components', name), 'utf8');
const workspace = source('workspace-nav.tsx');
const seller = source('seller/seller-shell.tsx');
const admin = source('admin/admin-shell.tsx');

function pathsFrom(sourceText) {
  return [...sourceText.matchAll(/\{ href: '([^']+)', label:/g)].map((match) => match[1]);
}

test('both workspaces retain every existing destination', () => {
  assert.deepEqual(pathsFrom(seller), [
    '/seller', '/seller/products', '/seller/inventory', '/seller/orders', '/seller/analytics',
    '/seller/ai-insights', '/seller/payments', '/seller/escrow', '/seller/disputes', '/seller/settings',
  ]);
  assert.deepEqual(pathsFrom(admin), [
    '/admin', '/admin/users', '/admin/sellers', '/admin/products', '/admin/orders',
    '/admin/payments', '/admin/escrow', '/admin/disputes', '/admin/fraud-alerts',
    '/admin/reports', '/admin/settings',
  ]);
});

test('small and tablet viewports get compact native keyboard-operable navigation', () => {
  assert.match(workspace, /<details\s/);
  assert.match(workspace, /<summary className=/);
  assert.match(workspace, /xl:hidden/);
  assert.match(workspace, /event\.key !== 'Escape'/);
  assert.match(workspace, /querySelector\('summary'\)\?\.focus\(\)/);
  assert.match(workspace, /max-h-\[min\(65dvh,27rem\)\]/);
  assert.match(workspace, /overflow-y-auto overscroll-contain/);
});

test('desktop workspaces get a sticky sidebar only at xl and above', () => {
  assert.match(workspace, /xl:sticky xl:top-24 xl:block/);
  assert.match(workspace, /aria-label=\{`\$\{name\} desktop sections`\}/);
  assert.match(seller, /xl:grid-cols-\[220px_minmax\(0,1fr\)\]/);
  assert.match(admin, /xl:grid-cols-\[230px_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(seller + admin, /lg:grid-cols-\[/);
});

test('nav announces the active section and resets on route change', () => {
  assert.match(workspace, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(workspace, /key=\{pathname\}/);
  assert.match(workspace, /current\?\.label \?\? 'Sections'/);
  assert.match(workspace, /closest\('details'\)/);
  assert.match(workspace, /focus-visible:ring-2/);
});

test('both existing auth gates still wrap their workspaces', () => {
  assert.match(seller, /<SellerGate>/);
  assert.match(admin, /<AdminGate>/);
  assert.match(seller, /<WorkspaceNav kind="seller" pathname=\{pathname\} links=\{links\} \/>/);
  assert.match(admin, /<WorkspaceNav kind="admin" pathname=\{pathname\} links=\{links\} \/>/);
});
