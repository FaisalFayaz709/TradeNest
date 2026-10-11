import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
function invoke(file, url) {
  return spawnSync(process.execPath, [fileURLToPath(new URL(`../${file}`, import.meta.url))], {
    cwd: root,
    env: { ...process.env, TEST_DATABASE_URL: url },
    encoding: 'utf8',
  });
}
test('Database migration chain matches the unmodified Foundation baseline', () => {
  const r = invoke('verify-database-migration-chain.mjs', '');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /28 model\/table mappings checked/);
});
test('Database refuses a non-local test database', () => {
  const r = invoke('verify-database-target.mjs', 'postgresql://u:p@external.invalid/tradenest_test');
  assert.notEqual(r.status, 0);
});
test('Database refuses a production database even on localhost', () => {
  const r = invoke('verify-database-target.mjs', 'postgresql://u:p@127.0.0.1/tradenest_production');
  assert.notEqual(r.status, 0);
});
test('Database refuses alternative schemas', () => {
  const r = invoke('verify-database-target.mjs', 'postgresql://u:p@127.0.0.1/tradenest_test?schema=unsafe');
  assert.notEqual(r.status, 0);
});
test('Database accepts isolated loopback database', () => {
  const r = invoke('verify-database-target.mjs', 'postgresql://u:p@127.0.0.1/tradenest_test?schema=public');
  assert.equal(r.status, 0, r.stderr);
});
