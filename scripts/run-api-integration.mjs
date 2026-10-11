import { spawnSync } from 'node:child_process';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  console.error('TEST_DATABASE_URL is required. Use an isolated database such as tradenest_test.');
  process.exit(1);
}
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '').toLowerCase();
if (!databaseName.includes('test') && !databaseName.includes('e2e')) {
  console.error(`Refusing API integration setup against non-test database: ${databaseName}`);
  process.exit(1);
}

function run(args, extraEnv = {}) {
  const result = spawnSync('pnpm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const env = { DATABASE_URL: databaseUrl, TEST_DATABASE_URL: databaseUrl, NODE_ENV: 'test' };
run(['--filter', '@tradenest/api', 'db:migrate:deploy'], env);
run(['--filter', '@tradenest/api', 'test:integration'], env);
