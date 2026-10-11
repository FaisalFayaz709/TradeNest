/** Stream a PostgreSQL 18 custom-format backup; checksum + metadata written only on success. */
import { createHash } from 'node:crypto';
import { chmodSync, createWriteStream, existsSync, lstatSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { assertPostgres18, deploymentConfig, dockerArgs, parseOptions, repoRoot } from './ops/pg-compose.mjs';

async function main() {
  const opts = parseOptions(process.argv.slice(2));
  if (!opts.output || Object.keys(opts).some((k) => !['output', 'env'].includes(k))) throw new Error('Usage: node scripts/ops-backup.mjs --output <absolute-or-relative-path.dump> [--env <deploy.env>]');
  const config = deploymentConfig(opts.env);
  const target = resolve(opts.output);
  if (!target.endsWith('.dump')) throw new Error('Output must end with .dump (PostgreSQL custom archive).');
  if (target.startsWith(`${repoRoot}/apps/`) || target.startsWith(`${repoRoot}/services/`)) throw new Error('Never save raw backups in the application source tree.');
  if (existsSync(target) || existsSync(`${target}.manifest.json`)) throw new Error('Refusing to overwrite an existing backup.');
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const folder = lstatSync(dirname(target));
  if (folder.isSymbolicLink()) throw new Error('Symlink backup directory is not allowed.');
  assertPostgres18(config);
  const temp = `${target}.partial-${process.pid}`;
  const hash = createHash('sha256');
  let length = 0;
  let magic = Buffer.alloc(0);
  const child = spawn('docker', dockerArgs(config.path, 'pg_dump', ['-Fc', '--no-owner', '--no-acl', '-U', config.user, '-d', config.database]), { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (data) => { stderr = `${stderr}${data.toString()}`.slice(-500); });
  child.stdout.on('data', (buffer) => {
    hash.update(buffer);
    length += buffer.length;
    if (magic.length < 5) magic = Buffer.concat([magic, buffer.subarray(0, 5 - magic.length)]);
  });
  try {
    await Promise.all([
      pipeline(child.stdout, createWriteStream(temp, { flags: 'wx', mode: 0o600 })),
      new Promise((ok, fail) => {
        child.on('error', fail);
        child.on('close', (code) => code === 0 ? ok() : fail(new Error(`pg_dump failed (exit ${code}): ${stderr}`)));
      }),
    ]);
    if (length <= 5 || magic.toString('utf8') !== 'PGDMP') throw new Error('pg_dump did not produce a nonempty custom-format archive.');
    chmodSync(temp, 0o600);
    renameSync(temp, target);
    const manifest = {
      kind: 'TradeNest PostgreSQL 18 recovery backup',
      postgresMajor: 18, sourceDatabase: config.database, createdAt: new Date().toISOString(),
      file: basename(target), bytes: length, sha256: hash.digest('hex'),
      warning: 'Contains sensitive marketplace data. Encrypt before off-host transfer. Not production-acceptance evidence until a restore drill succeeds.',
    };
    writeFileSync(`${target}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log(`BACKUP CREATED: ${target} (${length} bytes). Restore-drill verification is still required.`);
  } catch (error) {
    child.kill();
    rmSync(temp, { force: true });
    throw error;
  }
}
main().catch((error) => { console.error(`BACKUP FAILED: ${error.message}`); process.exitCode = 1; });
