import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const src = (name) => readFileSync(resolve(root, name), 'utf8');
const checks = [
  ['Origin guard is implemented in the web boundary', 'apps/web/lib/mutation-origin.ts', /function isSameOriginMutation/],
  ['Write-route proxy is guarded', 'apps/web/app/api/tradenest/[...path]/route.ts', /rejectCrossOriginMutation\(request\)/],
  ['Test helper refuses production activation', 'apps/web/app/api/__e2e/session/route.ts', /NODE_ENV === 'production'/],
  ['Default security response headers', 'apps/api/src/main.ts', /X-Content-Type-Options/],
  ['Security negative tests', 'scripts/tests/security-guards.test.mjs', /cross-origin web mutation is rejected/],
  ['Security browser security scenarios', 'apps/web/e2e/security-security-boundaries.spec.ts', /malicious origin/],
  ['Security complete CI gate', '.github/workflows/security-regression.yml', /frozen-lockfile/],
  ['Locked environment preflight', 'scripts/accept-security.mjs', /accept-payment-compliance\.mjs/],
  ['No write access to original specifications', 'SPEC_LOCK.yaml', /stack:/],
];
let failed = 0;
for (const [name, path, pattern] of checks) {
  const full = resolve(root, path);
  const ok = existsSync(full) && pattern.test(src(path));
  console.log(`SECURITY ${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`SECURITY STATIC PASSED: ${checks.length}/${checks.length}`);
