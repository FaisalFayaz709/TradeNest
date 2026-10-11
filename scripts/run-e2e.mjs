import { spawnSync } from 'node:child_process';

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) {
  console.error('E2E_DATABASE_URL is required. Use an isolated database such as tradenest_e2e.');
  process.exit(1);
}
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '').toLowerCase();
if (!databaseName.includes('e2e') && !databaseName.includes('test')) {
  console.error(`Refusing Playwright setup against non-test database: ${databaseName}`);
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

const apiEnv = { DATABASE_URL: databaseUrl, E2E_DATABASE_URL: databaseUrl, NODE_ENV: 'test' };
run(['--filter', '@tradenest/api', 'db:migrate:deploy'], apiEnv);
run(['--filter', '@tradenest/api', 'e2e:seed'], apiEnv);
run(['--filter', '@tradenest/web', 'test:e2e'], apiEnv);
