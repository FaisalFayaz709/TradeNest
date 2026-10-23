import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const commerce = readFileSync(new URL('../../apps/web/e2e/commerce-workflows.spec.ts', import.meta.url), 'utf8');
const policies = readFileSync(new URL('../../apps/api/src/common/rate-limit/rate-limit.policies.ts', import.meta.url), 'utf8');
const security = readFileSync(new URL('../../apps/web/e2e/security-security-boundaries.spec.ts', import.meta.url), 'utf8');

test('commerce reuses distinct HttpOnly sessions when switching buyer, seller and admin roles', () => {
  assert.match(commerce, /sessionCookiesByRole = new Map<AccountRole, SessionCookies>\(\)/);
  assert.match(commerce, /sessionCookieNames = new Set\(\['tradenest_access', 'tradenest_refresh'\]\)/);
  assert.match(commerce, /await context\.clearCookies\(\)/);
  assert.match(commerce, /await context\.addCookies\(previouslyAuthenticated\)/);
  assert.match(commerce, /expect\(session\.data\?\.role\)\.toBe\(role\)/);
  assert.match(commerce, /await page\.goto\(role === 'BUYER'/);
});

test('the first login for each role still exercises the real web authentication form', () => {
  assert.match(commerce, /await page\.goto\('\/auth\/login'\)/);
  assert.match(commerce, /getByLabel\('Email'\)\.fill\(accounts\[role\]\)/);
  assert.match(commerce, /getByRole\('button', \{ name: 'Sign in' \}\)\.click\(\)/);
  assert.match(commerce, /expect\(cookies\.map\(\(cookie\) => cookie\.name\)\.sort\(\)\)\.toEqual/);
  assert.doesNotMatch(commerce, /console\.(log|debug)\(.*(cookie|token)/i);
});

test('production login policies and security checks are left intact', () => {
  assert.match(policies, /AUTH_LOGIN_IP: \{ name: 'AUTH_LOGIN_IP', limit: 20, windowMs: 5 \* minute/);
  assert.match(policies, /AUTH_LOGIN_IDENTITY: \{ name: 'AUTH_LOGIN_IDENTITY', limit: 8, windowMs: 5 \* minute/);
  assert.match(security, /buyer cannot access seller analytics or administrator records/);
  assert.match(security, /expect\(admin\.status\(\)\)\.toBe\(403\)/);
});
