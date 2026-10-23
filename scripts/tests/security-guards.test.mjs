import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSameOriginMutation, rejectCrossOriginMutation } from '../../apps/web/lib/mutation-origin.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const source = (path) => readFileSync(resolve(root, path), 'utf8');
const sample = (method, origin, fetchSite, url = 'https://market.tradenest.example/api/tradenest/checkout') => {
  const headers = new Headers();
  if (origin !== undefined) headers.set('origin', origin);
  if (fetchSite !== undefined) headers.set('sec-fetch-site', fetchSite);
  return { method, url, headers };
};

for (const method of ['POST', 'PATCH', 'DELETE']) {
  test(`${method} same-origin web mutation is allowed`, () => {
    assert.equal(isSameOriginMutation(sample(method, 'https://market.tradenest.example', 'same-origin')), true);
  });
  test(`${method} cross-origin web mutation is rejected before upstream`, () => {
    const request = sample(method, 'https://attacker.example', 'cross-site');
    assert.equal(isSameOriginMutation(request), false);
    const response = rejectCrossOriginMutation(request);
    assert.equal(response?.status, 403);
    assert.equal(response?.headers.get('cache-control'), 'no-store');
  });
}
for (const [label, origin, site] of [
  ['same-site sibling domain', 'https://evil.tradenest.example', 'same-site'],
  ['opaque origin', 'null', 'cross-site'],
  ['HTTP downgrade', 'http://market.tradenest.example', 'same-origin'],
  ['origin with path', 'https://market.tradenest.example/admin', 'same-origin'],
  ['origin with embedded credentials', 'https://a@market.tradenest.example', 'same-origin'],
  ['forged fetch metadata', 'https://market.tradenest.example', 'cross-site'],
  ['missing all browser origin signals', undefined, undefined],
  ['missing origin from explicitly cross-site fetch', undefined, 'cross-site'],
]) {
  test(`reject ${label}`, () => assert.equal(isSameOriginMutation(sample('POST', origin, site)), false));
}
test('same-origin Fetch Metadata alone is accepted for older browser requests', () => {
  assert.equal(isSameOriginMutation(sample('POST', undefined, 'same-origin')), true);
});
test('safe reads stay available without an Origin header', () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    assert.equal(isSameOriginMutation(sample(method, undefined, undefined)), true);
  }
});
test('web proxy invokes origin guard before route dispatch and upstream access', () => {
  const text = source('apps/web/app/api/tradenest/[...path]/route.ts');
  const reject = text.indexOf('const rejected = rejectCrossOriginMutation(request);');
  assert.ok(reject >= 0 && reject < text.indexOf('const { path: segments }'));
  assert.ok(reject < text.indexOf('authenticatedUpstream('));
});
test('all cookie-session mutation routes reject cross-origin requests before contacting NestJS', () => {
  for (const route of ['login', 'register', 'register-seller', 'logout', 'logout-all']) {
    const text = source(`apps/web/app/api/session/${route}/route.ts`);
    const guard = text.indexOf('const rejected = rejectCrossOriginMutation(request);');
    const fetchPos = [text.indexOf('apiFetch('), text.indexOf('authenticatedUpstream(')].filter((n) => n >= 0);
    assert.ok(guard >= 0 && fetchPos.length && guard < Math.min(...fetchPos));
  }
});
test('E2E helper cannot be enabled in production or bridge to a non-loopback API', () => {
  const text = source('apps/web/app/api/%5F_e2e/session/route.ts');
  assert.match(text, /process\.env\.NODE_ENV === 'production'/);
  assert.match(text, /base\.protocol === 'http:' && \['localhost', '127\.0\.0\.1', '\[::1\]'\]/);
});
test('NestJS emits baseline security headers without permitting browser payment authority', () => {
  const text = source('apps/api/src/main.ts');
  assert.match(text, /X-Content-Type-Options/);
  assert.match(text, /Referrer-Policy/);
  assert.match(text, /X-Powered-By/);
  assert.doesNotMatch(source('apps/web/lib/mutation-origin.ts'), /@prisma\/client|paymentProvider|markSucceeded/);
});
