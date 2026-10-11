/** Final release gate; the entire previous live acceptance and operational drill are mandatory. */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deploymentConfig } from './ops/pg-compose.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
function run(label, command, args) {
  console.log(`\nOPERATIONS GATE: ${label}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  if (result.error || result.status !== 0) { console.error(`OPERATIONS NOT ACCEPTED: ${label}`); process.exit(result.status || 1); }
}
// Require staging authorization BEFORE any deploy or integration step.
const { RELEASE_STAGING_ACK, RELEASE_BACKUP_OUTPUT, RELEASE_RECOVERY_DATABASE, RELEASE_WEB_ORIGIN, RELEASE_API_ORIGIN } = process.env;
if (RELEASE_STAGING_ACK !== 'STAGING_DRILL_AUTHORIZED' || !RELEASE_BACKUP_OUTPUT || !RELEASE_RECOVERY_DATABASE || !RELEASE_WEB_ORIGIN || !RELEASE_API_ORIGIN) {
  console.error('OPERATIONS NOT ACCEPTED: staging authorization, backup output, recovery database and monitored origins are required.');
  process.exit(1);
}
try {
  if (!deploymentConfig().database.endsWith('_staging')) throw new Error('Operations automated acceptance is staging-only: POSTGRES_DB must end in _staging.');
} catch (error) {
  console.error(`OPERATIONS NOT ACCEPTED: ${error.message}`);
  process.exit(1);
}
run('Architecture and all Operations operational regressions', process.execPath, ['scripts/verify-operations.mjs']);
run('Operator tool safety tests', process.execPath, ['--test', 'scripts/tests/operations.test.mjs']);
run('All prerequisite acceptance suites, frozen install, API, PostgreSQL, Stripe, S3 and E2E acceptance', process.execPath, ['scripts/accept-security.mjs']);
run('Locked toolchain and deployment preflight', process.execPath, ['scripts/deployment-preflight.mjs']);
run('Compose config validation', 'docker', ['compose','--env-file','infrastructure/docker/deploy.env','-f','docker-compose.deploy.yml','config','--quiet']);
run('Container builds', 'docker', ['compose','--env-file','infrastructure/docker/deploy.env','-f','docker-compose.deploy.yml','build']);
run('Deploy to staging', 'docker', ['compose','--env-file','infrastructure/docker/deploy.env','-f','docker-compose.deploy.yml','up','-d']);
run('Live API/web health checks', process.execPath, ['scripts/deployment-smoke.mjs']);
run('External HTTPS monitor', process.execPath, ['scripts/ops-health-check.mjs','--web',RELEASE_WEB_ORIGIN,'--api',RELEASE_API_ORIGIN]);
run('Produce protected database backup', process.execPath, ['scripts/ops-backup.mjs','--output',RELEASE_BACKUP_OUTPUT]);
run('Restore to NEW isolated recovery database', process.execPath, ['scripts/ops-restore-drill.mjs','--backup',RELEASE_BACKUP_OUTPUT,'--target',RELEASE_RECOVERY_DATABASE,'--confirm',`RESTORE ${RELEASE_RECOVERY_DATABASE}`]);
console.log('AUTOMATED OPERATIONS GATES PASSED. Production sign-off STILL requires documented TLS, off-site encrypted backups, external service acceptance, monitoring/alert routing, recovery objective review and owner authorization.');
