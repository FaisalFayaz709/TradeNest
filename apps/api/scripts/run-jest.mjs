import { spawnSync } from 'node:child_process';

const suite = process.argv[2];
if (!['unit', 'integration'].includes(suite)) {
  console.error('Usage: node scripts/run-jest.mjs <unit|integration>');
  process.exit(2);
}
const testPath = suite === 'unit' ? 'test/unit' : 'test/integration';
const current = process.env.NODE_OPTIONS?.trim();
const vmFlag = '--experimental-vm-modules';
const nodeOptions = current?.includes(vmFlag) ? current : [current, vmFlag].filter(Boolean).join(' ');
const result = spawnSync('pnpm', ['exec', 'jest', '--config', 'jest.config.cjs', '--runInBand', testPath], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
});
process.exit(result.status ?? 1);
