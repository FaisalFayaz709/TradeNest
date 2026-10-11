import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.argv[2] ?? 'infrastructure/docker/deploy.env');
if (!existsSync(envPath)) {
  console.error(`Deployment environment file not found: ${envPath}`);
  process.exit(1);
}

const values = new Map();
for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const index = line.indexOf('=');
  if (index <= 0) continue;
  values.set(line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, ''));
}

const bind = values.get('DEPLOY_BIND_ADDRESS') ?? '127.0.0.1';
const host = ['0.0.0.0', '::'].includes(bind) ? '127.0.0.1' : bind;
const webPort = values.get('WEB_PUBLISH_PORT') ?? '3000';
const apiPort = values.get('API_PUBLISH_PORT') ?? '4000';

const probes = [
  { name: 'API liveness', url: `http://${host}:${apiPort}/api/v1/health`, status: 'ok' },
  { name: 'API readiness', url: `http://${host}:${apiPort}/api/v1/health/ready`, status: 'ready' },
  { name: 'Web liveness', url: `http://${host}:${webPort}/api/health`, status: 'ok' },
  { name: 'Web readiness', url: `http://${host}:${webPort}/api/health/ready`, status: 'ready' },
];

async function probe(spec) {
  let last = 'not attempted';
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(spec.url, { cache: 'no-store', signal: AbortSignal.timeout(3_000) });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.status === spec.status) return;
      last = `HTTP ${response.status}, status=${body.status ?? 'missing'}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
  }
  throw new Error(`${spec.name} failed at ${spec.url}: ${last}`);
}

try {
  for (const spec of probes) {
    await probe(spec);
    console.log(`PASS ${spec.name}`);
  }
  console.log('TRADENEST DEPLOYMENT SMOKE TEST PASSED');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
