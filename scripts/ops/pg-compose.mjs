/** Operations: constrained operator helpers. No shell expansion or credential logging. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const repoRoot = resolve(import.meta.dirname, '../..');
export const defaultEnvPath = resolve(repoRoot, 'infrastructure/docker/deploy.env');
export const composeFile = resolve(repoRoot, 'docker-compose.deploy.yml');
const identifier = /^[a-z][a-z0-9_]{0,62}$/;
export function parseOptions(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!/^--[a-z-]+$/.test(argv[i]) || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Invalid or missing option: ${argv[i] ?? '(empty)'}`);
    const key = argv[i].slice(2);
    if (Object.hasOwn(result, key)) throw new Error(`Duplicate option: --${key}`);
    result[key] = argv[i + 1];
  }
  return result;
}
export function deploymentConfig(path = defaultEnvPath) {
  const full = resolve(path);
  if (!existsSync(full)) throw new Error('Missing deployment environment file.');
  const settings = new Map();
  for (const line of readFileSync(full, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) throw new Error('Malformed deployment environment file.');
    let value = line.slice(eq + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    settings.set(line.slice(0, eq).trim(), value);
  }
  const user = settings.get('POSTGRES_USER') ?? '';
  const name = settings.get('POSTGRES_DB') ?? '';
  if (!identifier.test(user) || !identifier.test(name)) throw new Error('POSTGRES_USER / POSTGRES_DB must be simple lowercase PostgreSQL identifiers.');
  return { path: full, user, database: name };
}
export function dockerArgs(envFile, program, args = []) {
  return ['compose', '--env-file', envFile, '-f', composeFile, 'exec', '-T', 'postgres', program, ...args];
}
export function runDocker(envFile, program, args) {
  const result = spawnSync('docker', dockerArgs(envFile, program, args), { cwd: repoRoot, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`${program} failed: ${result.error?.message ?? (result.stderr ?? '').slice(0, 400)}`);
  return (result.stdout ?? '').trim();
}
export function assertPostgres18(config) {
  const version = runDocker(config.path, 'psql', ['-X', '-A', '-t', '-U', config.user, '-d', config.database, '-c', 'SHOW server_version_num;']);
  if (!/^18\d{4}$/.test(version)) throw new Error('The running database is not PostgreSQL 18.');
}
