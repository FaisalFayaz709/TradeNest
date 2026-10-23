import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const admin = source('apps/web/app/admin/disputes/[id]/page.tsx');
const notifications = source('apps/web/app/notifications/page.tsx');
const wishlist = source('apps/web/app/wishlist/page.tsx');
const insights = source('apps/web/app/seller/ai-insights/page.tsx');
const postcss = source('apps/web/postcss.config.mjs');

test('admin dispute loading does not trigger synchronous React effect setters', () => {
  assert.match(admin, /<DisputeDetail key=\{id\} id=\{id\} \/>/);
  assert.match(admin, /useEffect\(\(\) => \{\s*let active = true;/);
  assert.match(admin, /if \(active\) setDispute\(result\)/);
  assert.match(admin, /if \(active\) setLoading\(false\)/);
  assert.match(admin, /return \(\) => \{ active = false; \};/);
  assert.doesNotMatch(admin, /useEffect\(\(\) => \{ void load\(\)/);
});

test('admin dispute resolution preserves backend authority and idempotency', () => {
  assert.match(admin, /if \(!id \|\| busyRef\.current \|\| dispute\?\.status !== 'OPEN'\) return;/);
  assert.match(admin, /`admin\/disputes\/\$\{id\}\/resolve`, 'POST', \{ resolution \}, \{ 'Idempotency-Key': key \}/);
  assert.match(admin, /idempotencyKey\(`admin-dispute-\$\{id\}-\$\{resolution\.toLowerCase\(\)\}`\)/);
  assert.match(admin, /setDispute\(await apiData<Dispute>\(`disputes\/\$\{id\}`\)\)/);
  assert.match(admin, /keys\.current\.delete\(resolution\)/);
  assert.doesNotMatch(admin, /releaseEscrow|writeLedger|markPaid/);
});

test('notifications start asynchronous reads and cancel stale session results', () => {
  assert.match(notifications, /<NotificationsContent key=\{user\.id\} \/>/);
  assert.match(notifications, /useEffect\(\(\) => \{\s*let active = true;/);
  assert.match(notifications, /apiCollection<Notice>\('notifications\?page=1&limit=20'\)/);
  assert.match(notifications, /if \(!active\) return;/);
  assert.match(notifications, /return \(\) => \{ active = false; \};/);
  assert.doesNotMatch(notifications, /useEffect\(\(\) => \{ if \(user\) void load\(1\)/);
});

test('notifications preserve mark-read API requests and pagination', () => {
  assert.match(notifications, /`notifications\/\$\{id\}\/read` : 'notifications\/read-all', 'PATCH'/);
  assert.match(notifications, /notifications\?page=\$\{current\}&limit=20/);
  assert.match(notifications, /onClick=\{\(\) => void load\(page - 1\)\}/);
  assert.match(notifications, /onClick=\{\(\) => void load\(page \+ 1\)\}/);
});

test('wishlist uses the existing remote-image convention without suppressing lint', () => {
  assert.match(wishlist, /import Image from 'next\/image'/);
  assert.match(wishlist, /<Image src=\{product\.images\[0\]\.url\} alt="" fill sizes=/);
  assert.match(wishlist, /unoptimized className="object-cover"/);
  assert.match(wishlist, /relative aspect-\[4\/3\]/);
  assert.doesNotMatch(wishlist, /<img\b|eslint-disable/);
  assert.match(wishlist, /jsonData\('cart\/items', 'POST', \{ productId, quantity: 1 \}\)/);
});

test('seller pricing import and PostCSS default export no longer produce lint warnings', () => {
  assert.match(insights, /import \{ jsonData \} from '@\/lib\/api-client'/);
  assert.doesNotMatch(insights, /import \{ apiData, jsonData \}/);
  assert.match(insights, /price-suggestion/);
  assert.match(postcss, /const config = \{/);
  assert.match(postcss, /export default config;/);
  assert.doesNotMatch(postcss, /export default \{/);
});
