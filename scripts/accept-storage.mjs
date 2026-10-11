/** Full fail-closed Storage acceptance. No implied sign-off when S3 or locked runtimes are absent. */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
function step(name, cmd, args) {
  console.log(`\nSTORAGE: ${name}`);
  const result = spawnSync(cmd,args,{ cwd:root, stdio:'inherit', shell:process.platform==='win32' });
  if (result.error || result.status!==0) {
    console.error(`STORAGE BLOCKED at ${name}. No runtime-complete claim is authorized.`);
    process.exit(result.status && result.status!==0 ? result.status : 1);
  }
}
step('source guard checks',process.execPath,[resolve(root,'scripts/verify-storage.mjs')]);
step('negative-regression guards',process.execPath,['--test',resolve(root,'scripts/tests/storage-guards.test.mjs')]);
step('require isolated localhost PostgreSQL test database',process.execPath,[resolve(root,'scripts/verify-database-target.mjs')]);
if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
  console.error('STORAGE REFUSED: DATABASE_URL must equal approved TEST_DATABASE_URL.'); process.exit(1);
}
step('new database migration and schema consistency', 'pnpm', ['--filter','@tradenest/api','db:migrate:deploy']);
step('prior Api contracts API and database acceptance', 'pnpm', ['acceptance:api-contracts']);
step('live S3-compatible test bucket operations','pnpm',['--filter','@tradenest/api','verify:storage:storage']);
step('frontend end-to-end regressions', 'pnpm',['test:e2e']);
step('final architecture lock verification','pnpm',['verify:architecture']);
console.log('\nSTORAGE ACCEPTED: storage + API + migrations + E2E + locked architecture executed successfully.');
