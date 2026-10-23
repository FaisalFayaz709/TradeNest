import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const login = readFileSync(new URL('../../apps/web/app/auth/login/login-client.tsx', import.meta.url), 'utf8');
const accessibility = readFileSync(new URL('../../apps/web/e2e/frontend-frontend-accessibility.spec.ts', import.meta.url), 'utf8');
const smoke = readFileSync(new URL('../../apps/web/e2e/auth-login-diagnostics.spec.ts', import.meta.url), 'utf8');

test('login form never sends credentials through the default native GET method', () => {
  assert.match(login, /<form method="post" onSubmit=\{submit\}/);
  assert.match(login, /event\.preventDefault\(\)/);
});

test('login submission only enables after React hydration', () => {
  assert.match(login, /useSyncExternalStore\(subscribeToHydration, hydratedSnapshot, serverSnapshot\)/);
  assert.match(login, /const serverSnapshot = \(\) => false/);
  assert.match(login, /disabled=\{busy \|\| !hydrated\}/);
});

test('auth gate Playwright locator is scoped to main content', () => {
  assert.match(accessibility, /page\.getByRole\('main'\)\.getByRole\('link', \{ name: 'Sign in' \}\)/);
});

test('browser login smoke test diagnoses auth failures without exposing tokens', () => {
  assert.match(smoke, /response\.status\(\)/);
  assert.match(smoke, /api\/session\/me/);
  assert.doesNotMatch(smoke, /console\.log|JSON\.stringify\(payload\)/);
});
