import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const envPath = resolve(process.argv[2] ?? 'infrastructure/docker/deploy.env');
const failures = [];
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor !== 24) failures.push(`Node.js 24 is required; current runtime is ${process.version}.`);
if (packageJson.packageManager !== 'pnpm@10.15.1') failures.push('packageManager must remain pinned to pnpm@10.15.1.');
if (packageJson.engines?.node !== '>=24.0.0 <25') failures.push('package.json engines.node must remain locked to Node.js 24.');

const lockPath = resolve(root, 'pnpm-lock.yaml');
if (!existsSync(lockPath)) {
  failures.push('pnpm-lock.yaml is required for frozen production installs. Generate and review it under Node.js 24 + pnpm 10.15.1.');
} else {
  const lock = readFileSync(lockPath, 'utf8');
  if (!/^lockfileVersion:/m.test(lock) || !/^importers:/m.test(lock)) failures.push('pnpm-lock.yaml does not look like a valid shared-workspace pnpm lockfile.');
}

function commandVersion(command, args, expected, label) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') {
    failures.push(`${label} is required but was not found.`);
    return;
  }
  if (result.status !== 0) {
    failures.push(`${label} check failed.`);
    return;
  }
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (expected && !expected.test(output)) failures.push(`${label} version is outside the deployment contract: ${output}`);
}

commandVersion('pnpm', ['--version'], /^10\.15\.1(?:\s|$)/, 'pnpm 10.15.1');
commandVersion('docker', ['--version'], /Docker version/i, 'Docker');
commandVersion('docker', ['compose', 'version'], /Docker Compose version/i, 'Docker Compose');

const envValidation = spawnSync(process.execPath, [resolve(root, 'scripts/validate-deployment-env.mjs'), envPath], { encoding: 'utf8' });
if (envValidation.status !== 0) {
  failures.push('Deployment environment validation failed.');
  const detail = `${envValidation.stdout ?? ''}${envValidation.stderr ?? ''}`.trim();
  if (detail) failures.push(detail.replace(/\n/g, ' | '));
}

if (failures.length) {
  console.error('TRADENEST DEPLOYMENT PREFLIGHT FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('TRADENEST DEPLOYMENT PREFLIGHT PASSED');
console.log(`- Node ${process.versions.node}`);
console.log('- pnpm 10.15.1');
console.log('- reviewed pnpm-lock.yaml present');
console.log('- Docker + Compose available');
console.log('- deployment environment valid');
