import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('loading state is announced without speaking the animation', () => {
  const text = source('apps/web/components/loading-state.tsx');
  assert.match(text, /role="status"/);
  assert.match(text, /aria-live="polite"/);
  assert.match(text, /aria-hidden="true"/);
  assert.match(text, /min-w-0/);
});

test('error notices keep alert semantics and wrap long messages', () => {
  const text = source('apps/web/components/error-notice.tsx');
  assert.match(text, /role="alert"/);
  assert.match(text, /\[overflow-wrap:anywhere\]/);
  assert.match(text, /\{message\}/);
});

test('empty states adapt padding and actions at small screen sizes', () => {
  const text = source('apps/web/components/empty-state.tsx');
  assert.match(text, /px-4 py-10/);
  assert.match(text, /sm:px-8 sm:py-14/);
  assert.match(text, /\[&>\*\]:w-full/);
  assert.match(text, /sm:\[&>\*\]:w-auto/);
  assert.match(text, /aria-hidden="true"/);
});

test('page headings and actions stay flexible on tablet widths', () => {
  const text = source('apps/web/components/page-shell.tsx');
  assert.match(text, /px-3 py-6/);
  assert.match(text, /lg:flex-row lg:items-end/);
  assert.match(text, /lg:max-w-\[50%\]/);
});

test('shared table scroller exposes a keyboard-focusable named region', () => {
  const text = source('apps/web/components/table-scroll.tsx');
  assert.match(text, /role="region"/);
  assert.match(text, /aria-label=\{label\}/);
  assert.match(text, /tabIndex=\{0\}/);
  assert.match(text, /overflow-x-auto/);
  assert.match(text, /Swipe or scroll sideways/);
});

test('both admin moderation tables retain every column and action inside accessible scroller', () => {
  for (const [file, minWidth] of [
    ['apps/web/app/admin/products/page.tsx', '950px'],
    ['apps/web/app/admin/users/page.tsx', '850px'],
  ]) {
    const text = source(file);
    assert.match(text, /<TableScroll label="[^"]+">/);
    assert.match(text, /<\/table>\s*<\/TableScroll>/);
    assert.ok(text.includes(`min-w-[${minWidth}]`));
    assert.match(text, /onClick=\{\(\) => void moderate/);
  }
});
