/** Restore ONLY into a brand-new isolated database with _recovery suffix. Never overwrite production. */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, lstatSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { assertPostgres18, deploymentConfig, dockerArgs, parseOptions, repoRoot, runDocker } from './ops/pg-compose.mjs';

async function main() {
  const opts = parseOptions(process.argv.slice(2));
  if (!opts.backup || !opts.target || opts.confirm !== `RESTORE ${opts.target}` || Object.keys(opts).some((k) => !['backup','target','confirm','env'].includes(k))) {
    throw new Error('Usage: node scripts/ops-restore-drill.mjs --backup <file.dump> --target <new_name_recovery> --confirm "RESTORE <new_name_recovery>" [--env <deploy.env>]');
  }
  const config = deploymentConfig(opts.env);
  const target = opts.target;
  if (!/^[a-z][a-z0-9_]{0,53}_recovery$/.test(target) || target === config.database) throw new Error('Restore target must be a NEW database ending in _recovery, never the active application database.');
  const backup = resolve(opts.backup);
  if (!existsSync(backup) || !existsSync(`${backup}.manifest.json`)) throw new Error('Both backup file and integrity manifest are required.');
  if (!lstatSync(backup).isFile() || !lstatSync(`${backup}.manifest.json`).isFile()) throw new Error('Backup and manifest must be regular files, not links.');
  const manifest = JSON.parse(readFileSync(`${backup}.manifest.json`, 'utf8'));
  if (manifest.postgresMajor !== 18 || manifest.file !== basename(backup) || !/^[a-f0-9]{64}$/.test(manifest.sha256)) throw new Error('Backup manifest is invalid.');
  const digest = createHash('sha256');
  let bytes = 0;
  let magic = Buffer.alloc(0);
  for await (const chunk of createReadStream(backup)) {
    digest.update(chunk);
    bytes += chunk.length;
    if (magic.length < 5) magic = Buffer.concat([magic, chunk.subarray(0, 5 - magic.length)]);
  }
  if (magic.toString('utf8') !== 'PGDMP' || manifest.bytes !== bytes || digest.digest('hex') !== manifest.sha256) throw new Error('Backup archive checksum/format mismatch.');
  assertPostgres18(config);
  const exists = runDocker(config.path, 'psql', ['-X', '-A', '-t', '-U', config.user, '-d', config.database, '-c', `SELECT 1 FROM pg_database WHERE datname = '${target}'`]);
  if (exists.trim()) throw new Error(`Restore target ${target} already exists; refuse to overwrite.`);
  runDocker(config.path, 'createdb', ['-U', config.user, target]);
  const child = spawn('docker', dockerArgs(config.path, 'pg_restore', ['--single-transaction', '--exit-on-error', '--no-owner', '--no-acl', '-U', config.user, '-d', target]), { cwd: repoRoot, stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (b) => { stderr = `${stderr}${b.toString()}`.slice(-600); });
  await Promise.all([
    pipeline(createReadStream(backup), child.stdin),
    new Promise((ok, fail) => { child.on('error', fail); child.on('close', (code) => code === 0 ? ok() : fail(new Error(`pg_restore exited ${code}: ${stderr}`))); }),
  ]);
  const count = Number(runDocker(config.path, 'psql', ['-X', '-A', '-t', '-U', config.user, '-d', target, '-c', "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"]));
  if (!Number.isSafeInteger(count) || count <= 0) throw new Error('Restored database has no public tables; drill not accepted.');
  console.log(`RESTORE DRILL PASSED: ${target} (${count} public tables). Active database ${config.database} untouched.`);
  console.log('Manually verify critical row counts and application integrity, then destroy the isolated recovery database using an approved change procedure.');
}
main().catch((error) => { console.error(`RESTORE DRILL FAILED: ${error.message}`); process.exitCode = 1; });
