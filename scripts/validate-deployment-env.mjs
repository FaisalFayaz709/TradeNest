import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.argv[2] ?? 'infrastructure/docker/deploy.env');
if (!existsSync(envPath)) {
  console.error(`Deployment environment file not found: ${envPath}`);
  console.error('Copy infrastructure/docker/deploy.env.example to infrastructure/docker/deploy.env and replace all placeholders.');
  process.exit(1);
}

const values = new Map();
for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const index = line.indexOf('=');
  if (index <= 0) continue;
  const key = line.slice(0, index).trim();
  let value = line.slice(index + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  values.set(key, value);
}

const failures = [];
const required = [
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'PAYMENT_SANDBOX_WEBHOOK_SECRET',
  'OBSERVABILITY_METRICS_TOKEN',
  'NEXT_PUBLIC_API_BASE_URL',
];
for (const key of required) {
  if (!values.get(key)) failures.push(`${key} is required.`);
}

for (const key of ['JWT_ACCESS_SECRET', 'PAYMENT_SANDBOX_WEBHOOK_SECRET', 'OBSERVABILITY_METRICS_TOKEN']) {
  const value = values.get(key) ?? '';
  if (value && value.length < 32) failures.push(`${key} must be at least 32 characters.`);
}

const password = values.get('POSTGRES_PASSWORD') ?? '';
if (password && password.length < 16) failures.push('POSTGRES_PASSWORD must be at least 16 characters for deployment.');

for (const [key, value] of values) {
  if (/replace-with|change-me|changeme|example-secret/i.test(value)) failures.push(`${key} still contains a placeholder value.`);
}

const databaseUrl = values.get('DATABASE_URL');
if (databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) failures.push('DATABASE_URL must use postgres:// or postgresql://.');
    const databaseName = parsed.pathname.replace(/^\//, '').toLowerCase();
    if (/(^|[_-])(test|e2e)([_-]|$)/.test(databaseName)) failures.push('DATABASE_URL must not target an obvious test/e2e database for deployment.');
  } catch {
    failures.push('DATABASE_URL must be a valid PostgreSQL URL.');
  }
}


const paymentProvider = values.get('PAYMENT_PROVIDER') ?? 'sandbox';
if (!['sandbox', 'stripe'].includes(paymentProvider)) {
  failures.push('PAYMENT_PROVIDER must be sandbox or stripe.');
}
if (paymentProvider === 'stripe') {
  const key = values.get('PAYMENT_STRIPE_SECRET_KEY') ?? '';
  const webhookSecret = values.get('PAYMENT_STRIPE_WEBHOOK_SECRET') ?? '';
  const origin = values.get('PAYMENT_STRIPE_RETURN_ORIGIN') ?? '';
  // Financial remediation/12R intentionally forbids live money until external certification.
  if (!/^sk_test_[A-Za-z0-9]+$/.test(key)) {
    failures.push('Stripe deployment currently requires a sk_test_ key. Live-money charges/refunds are blocked pending approval.');
  }
  if (!/^whsec_[A-Za-z0-9]+$/.test(webhookSecret)) failures.push('PAYMENT_STRIPE_WEBHOOK_SECRET must be a valid whsec_ secret.');
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) {
      failures.push('PAYMENT_STRIPE_RETURN_ORIGIN must be a bare HTTPS origin.');
    }
  } catch { failures.push('PAYMENT_STRIPE_RETURN_ORIGIN must be a valid bare HTTPS origin.'); }
}

const apiBase = values.get('NEXT_PUBLIC_API_BASE_URL');
if (apiBase) {
  try {
    const parsed = new URL(apiBase);
    if (parsed.protocol !== 'https:') failures.push('NEXT_PUBLIC_API_BASE_URL must use HTTPS for the deployment profile.');
    if (!parsed.pathname.replace(/\/$/, '').endsWith('/api/v1')) failures.push('NEXT_PUBLIC_API_BASE_URL must end with /api/v1.');
  } catch {
    failures.push('NEXT_PUBLIC_API_BASE_URL must be an absolute HTTPS URL.');
  }
}

if (failures.length) {
  console.error('DEPLOYMENT ENVIRONMENT VALIDATION FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('DEPLOYMENT ENVIRONMENT VALIDATION PASSED');
