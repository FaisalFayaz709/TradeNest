import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const playwright = read('apps/web/playwright.config.ts');

test('Playwright and Next.js use the canonical localhost browser origin', () => {
  assert.match(playwright, /baseURL: 'http:\/\/localhost:3000'/);
  assert.match(playwright, /url: 'http:\/\/localhost:3000\/api\/health'/);
  assert.match(playwright, /command: 'pnpm --filter @tradenest\/web dev --hostname localhost --webpack'/);
  // Do not bypass CSRF validation or alter the isolated API host.
  assert.doesNotMatch(playwright, /allowedDevOrigins|WEB_MUTATION_ORIGIN_FORBIDDEN/);
});

test('API and test database remain isolated from the Next.js browser host', () => {
  assert.match(playwright, /url: 'http:\/\/127\.0\.0\.1:4000\/api\/v1\/health\/ready'/);
  assert.match(playwright, /DATABASE_URL: databaseUrl/);
  assert.match(playwright, /TRADENEST_E2E_UI: '1'/);
});

test('the double-underscore role route uses a routable encoded directory', () => {
  const page = 'apps/web/app/%5F_e2e/page.tsx';
  assert.ok(existsSync(path.join(root, page)));
  assert.ok(!existsSync(path.join(root, 'apps/web/app/__e2e/page.tsx')));
  assert.match(read(page), /TRADENEST_E2E_UI !== '1'\) notFound\(\)/);
  assert.match(read(page), /export const dynamic = 'force-dynamic'/);
  assert.match(read('apps/web/e2e/role-workflows.spec.ts'), /page\.goto\('\/__e2e'\)/);
});

test('diagnostic session endpoint still disallows production and nonlocal backends', () => {
  const routePath = 'apps/web/app/api/%5F_e2e/session/route.ts';
  assert.ok(existsSync(path.join(root, routePath)), 'test-only API route must be registered by Next.js');
  assert.ok(!existsSync(path.join(root, 'apps/web/app/api/__e2e/session/route.ts')));
  const route = read(routePath);
  assert.match(route, /process\.env\.NODE_ENV === 'production'/);
  assert.match(route, /process\.env\.TRADENEST_E2E_UI !== '1'/);
  assert.match(route, /\['localhost', '127\.0\.0\.1', '\[::1\]'\]/);
});
