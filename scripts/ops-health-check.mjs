/** One-shot alerting probe suitable for a scheduler. Prints no credentials or raw bodies. */
import { parseOptions } from './ops/pg-compose.mjs';
const opts = parseOptions(process.argv.slice(2));
if (!opts.web || !opts.api || Object.keys(opts).some((k) => !['web', 'api'].includes(k))) {
  console.error('Usage: node scripts/ops-health-check.mjs --web <https-origin> --api <https-origin>');
  process.exit(2);
}
function base(origin) {
  const url = new URL(origin);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Use a bare origin without credentials, query or path.');
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) throw new Error('Public monitoring requires HTTPS (HTTP only for loopback).');
  return url.origin;
}
try {
  const web = base(opts.web);
  const api = base(opts.api);
  const endpoints = [
    [web, '/api/health', 'ok'], [web, '/api/health/ready', 'ready'],
    [api, '/api/v1/health', 'ok'], [api, '/api/v1/health/ready', 'ready'],
  ];
  const failures = [];
  for (const [origin, path, expected] of endpoints) {
    try {
      const res = await fetch(`${origin}${path}`, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5_000) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.status !== expected) failures.push(`${path}: unhealthy`);
    } catch { failures.push(`${path}: unavailable`); }
  }
  console.log(JSON.stringify({ service: 'tradenest', status: failures.length ? 'critical' : 'healthy', checks: endpoints.length, failures }));
  if (failures.length) process.exitCode = 1;
} catch (error) {
  console.error(`HEALTH PROBE REJECTED: ${error.message}`);
  process.exitCode = 2;
}
