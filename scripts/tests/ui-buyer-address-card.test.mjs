import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const profile = readFileSync(new URL('../../apps/web/app/profile/page.tsx', import.meta.url), 'utf8');
const commerce = readFileSync(new URL('../../apps/web/e2e/commerce-workflows.spec.ts', import.meta.url), 'utf8');

test('shipping address lines have independently discoverable elements', () => {
  assert.match(profile, /<address className="[^"]*not-italic/);
  assert.match(profile, /<p>\{item\.line1\}<\/p>/);
  assert.match(profile, /item\.line2 \? <p>\{item\.line2\}<\/p> : null/);
  assert.match(profile, /<p>\{item\.country\}<\/p>/);
  assert.doesNotMatch(profile, /<br \/>\{item\.line1\}/);
  assert.match(commerce, /getByText\('100 Test Avenue', \{ exact: true \}\)/);
});

test('address save, refresh and ownership APIs remain unchanged', () => {
  assert.match(profile, /jsonData\('users\/me\/addresses', 'POST', body\)/);
  assert.match(profile, /jsonData\(`users\/me\/addresses\/\$\{address\.id\}`, 'PATCH', body\)/);
  assert.match(profile, /apiData<Address\[\]>\('users\/me\/addresses'\)/);
  assert.match(profile, /jsonData\(`users\/me\/addresses\/\$\{id\}`, 'DELETE'\)/);
});
