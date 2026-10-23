import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const source = readFileSync(path.join(root, 'apps/web/components/site-header.tsx'), 'utf8');

test('full navigation starts at xl rather than the crowded tablet breakpoint', () => {
  assert.match(source, /aria-label="Main navigation"[^\n]*xl:flex/);
  assert.match(source, /xl:hidden/);
  assert.doesNotMatch(source, /md:flex|md:hidden/);
});

test('mobile header includes keyboard-dismissable menu and quick shopping links', () => {
  assert.match(source, /aria-controls="tradenest-mobile-navigation"/);
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.match(source, /menuButtonRef\.current\?\.focus\(\)/);
  assert.match(source, /aria-label="Cart"/);
  assert.match(source, /aria-label="Search"/);
});

test('mobile navigation scrolls within the available screen and announces current page', () => {
  assert.match(source, /max-h-\[calc\(100dvh-4rem\)\]/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(source, /focus-visible:ring-2/);
});

test('route changes remount the mobile nav and remove stale menu state', () => {
  assert.match(source, /<SiteHeaderContent key=\{pathname\} pathname=\{pathname\} \/>/);
});
