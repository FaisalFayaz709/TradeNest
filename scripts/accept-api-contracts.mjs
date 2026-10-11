/**
 * Full fail-closed Api contracts acceptance. Foundation and Database are prerequisites;
 * no claims of live API conformance when they have not passed.
 * Creates test users ONLY in a validated local *_test PostgreSQL database.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
function run(label, command, args, env = {}) {
  console.log(`\nAPI CONTRACTS: ${label}`);
  const result = spawnSync(command, args, {
    cwd: root, stdio: 'inherit', shell: process.platform === 'win32',
    env: {...process.env, ...env, PYTHONDONTWRITEBYTECODE: '1'},
  });
  if (result.error || result.status !== 0) {
    console.error(`API CONTRACTS BLOCKED at "${label}". No later steps can be certified.`);
    process.exit(result.status && result.status !== 0 ? result.status : 1);
  }
}
run('static blueprint API, guards, Zod and OpenAPI annotations',process.execPath,[resolve(root,'scripts/verify-api-contracts.mjs')]);
run('dependency-free regressions for route, security and validation drift',process.execPath,['--test',resolve(root,'scripts/tests/api-contracts-guards.test.mjs')]);
run('require local isolated PostgreSQL test target',process.execPath,[resolve(root,'scripts/verify-database-target.mjs')]);
if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
  console.error('API CONTRACTS BLOCKED: DATABASE_URL must equal approved TEST_DATABASE_URL.');
  process.exit(1);
}
const dbEnv = {DATABASE_URL:process.env.TEST_DATABASE_URL, TEST_DATABASE_URL:process.env.TEST_DATABASE_URL, NODE_ENV:'test'};
run('prerequisite Foundation locked environment and build acceptance', 'pnpm', ['acceptance:foundation'],dbEnv);
run('prerequisite Database live database acceptance', 'pnpm', ['acceptance:database'],dbEnv);
run('full workspace TypeScript checks','pnpm',['typecheck'],dbEnv);
run('full workspace lint checks','pnpm',['lint'],dbEnv);
run('full workspace builds','pnpm',['build'],dbEnv);
run('backend unit tests incl Api contracts guard/Zod coverage','pnpm',['test:api:unit'],dbEnv);
run('backend PostgreSQL integration tests','pnpm',['test:api:integration'],dbEnv);
run('real NestJS routes, generated OpenAPI, live HTTP auth/RBAC/ownership',
  'pnpm',['--filter','@tradenest/api','verify:api-contracts:runtime'],dbEnv);
run('final blueprint architecture verification','pnpm',['verify:architecture'],dbEnv);
console.log('\nAPI CONTRACTS ACCEPTED: 74 blueprint endpoints, Zod, route guards, Swagger, real auth and ownership flow, backend tests.');
console.log('API contract checks do not certify storage, production payments, or other lifecycle features.');
