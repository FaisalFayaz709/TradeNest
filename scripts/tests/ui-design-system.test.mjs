/** Patch 01 source-level design contract. No npm packages or running server required. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const source = (path) => readFileSync(resolve(root, path), 'utf8');
const css = source('apps/web/app/globals.css');
const token = (name) => {
  const match = css.match(new RegExp(`--tradenest-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  assert.ok(match, `Missing --tradenest-${name}`);
  return match[1];
};
const srgb = (value) => {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const channels = [1, 3, 5].map((offset) => srgb(parseInt(hex.slice(offset, offset + 2), 16)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (first, second) => {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

const palette = {
  navy: '#0b2a4a',
  blue: '#124c7c',
  teal: '#0fa3a3',
  'teal-light': '#ddf7f5',
  gold: '#d6a84b',
  'gold-light': '#fff6df',
  background: '#f7f9fc',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#122033',
  'text-secondary': '#5f6b7a',
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#dc2626',
};

test('the technical blueprint brand palette stays unchanged', () => {
  for (const [name, value] of Object.entries(palette)) {
    assert.equal(token(name).toLowerCase(), value, `Blueprint palette changed: ${name}`);
  }
});

test('semantic text and action tones meet WCAG AA normal-text contrast in declared usages', () => {
  const white = '#ffffff';
  for (const [textToken, surface, meaning] of [
    ['teal-ink', white, 'teal labels on white'],
    ['teal-ink', token('teal-light'), 'teal labels on AI panel'],
    ['gold-ink', token('gold-light'), 'escrow labels on gold panel'],
    ['success-ink', '#f0fdf4', 'success badge'],
    ['warning-ink', '#fffbeb', 'warning badge'],
    ['danger-ink', '#fef2f2', 'danger badge'],
    ['teal-action', white, 'AI action white text'],
    ['teal-hover', white, 'AI action hover white text'],
    ['focus', white, 'focus ring on white'],
    ['placeholder', white, 'placeholder on white'],
  ]) {
    const score = contrast(token(textToken), surface);
    assert.ok(score >= 4.5, `${meaning}: ${score.toFixed(2)}:1 is less than 4.5:1`);
  }
  assert.ok(contrast(token('border-strong'), white) >= 3, 'Visible form outlines need 3:1 contrast');
});

test('buttons expose readable AI actions, wrapping labels, focus and 44px minimum targets', () => {
  const button = source('apps/web/components/ui/button.tsx');
  assert.match(button, /bg-\[var\(--tradenest-teal-action\)\]/);
  assert.match(button, /hover:bg-\[var\(--tradenest-teal-hover\)\]/);
  assert.match(button, /focus-visible:ring-\[var\(--tradenest-focus\)\]/);
  assert.match(button, /whitespace-normal/);
  assert.match(button, /min-w-0/);
  assert.match(button, /min-h-11/);
  assert.match(button, /icon: 'size-11/);
  assert.match(button, /asChild\?: boolean/);
});

test('badges use semantic ink tokens rather than low-contrast bright accent text', () => {
  const badge = source('apps/web/components/ui/badge.tsx');
  for (const name of ['success-ink', 'warning-ink', 'danger-ink', 'teal-ink', 'gold-ink']) {
    assert.match(badge, new RegExp(`var\\(--tradenest-${name}\\)`));
  }
  assert.match(badge, /break-words/);
});

test('forms support keyboard focus, invalid states, small screens and readable placeholders', () => {
  for (const path of ['apps/web/components/ui/input.tsx', 'apps/web/components/ui/textarea.tsx']) {
    const component = source(path);
    for (const className of [
      'min-w-0', 'focus-visible:ring-2', 'aria-invalid:border-',
      'placeholder:text-[var(--tradenest-placeholder)]',
      'border-[var(--tradenest-border-strong)]', 'text-base',
    ]) assert.ok(component.includes(className), `${path} must use ${className}`);
  }
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /a\[href\]:focus-visible/);
});

test('cards and the page shell allow content to adapt rather than clip by default', () => {
  const card = source('apps/web/components/ui/card.tsx');
  const shell = source('apps/web/components/page-shell.tsx');
  assert.match(card, /min-w-0/);
  assert.match(card, /sm:p-6/);
  assert.match(shell, /min-w-0/);
  assert.match(shell, /break-words/);
  assert.match(shell, /flex-wrap/);
  assert.match(shell, /text-\[var\(--tradenest-teal-ink\)\]/);
});
