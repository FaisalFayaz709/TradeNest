/**
 * Local-only development runner. Python is intentionally kept outside pnpm's
 * Node workspace; the FastAPI service uses its own ignored virtualenv.
 *
 *   pnpm dev          -> NestJS + Next.js + FastAPI
 *   pnpm dev:ai       -> FastAPI only
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const aiDirectory = join(root, 'services', 'ai');
const python = join(aiDirectory, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const aiOnly = process.argv.includes('--ai-only');

const instructions = [
  'TradeNest AI requires a Python 3.12 or 3.13 virtual environment.',
  'Create it once from the repository root:',
  '  cd services/ai',
  '  python3.13 -m venv .venv  # or python3.12',
  '  .venv/bin/python -m pip install -e ".[dev]"',
  '  cd ../..',
  'Then run: pnpm dev',
].join('\n');

if (!existsSync(python)) {
  console.error(instructions);
  process.exit(1);
}

const validation = spawnSync(python, [
  '-c',
  'import sys; assert (3, 12) <= sys.version_info[:2] < (3, 14), "Requires Python 3.12 or 3.13"; import fastapi, uvicorn, sklearn, pandas, numpy',
], { cwd: aiDirectory, encoding: 'utf8', timeout: 30_000 });
if (validation.status !== 0) {
  console.error('TradeNest AI Python dependencies are missing or the Python version is unsupported.');
  console.error(instructions);
  if (validation.stderr) console.error(validation.stderr.trim());
  process.exit(1);
}

const definitions = [
  {
    name: 'FastAPI AI (127.0.0.1:8000)',
    command: python,
    args: ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', '8000'],
    cwd: aiDirectory,
  },
  ...(!aiOnly ? [{
    name: 'NestJS + Next.js (4000 + 3000)',
    command: 'pnpm',
    args: ['--parallel', '--filter', '@tradenest/api', '--filter', '@tradenest/web', 'run', 'dev'],
    cwd: root,
  }] : []),
];

const children = new Set();
let stopping = false;
let pendingExitCode = 0;

function signalChild(child, signal) {
  if (!child.pid) return;
  try {
    // On macOS/Linux each service owns its process group, so this also stops
    // nested Nest/Next and the Uvicorn reload worker on Ctrl+C.
    if (process.platform !== 'win32') process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error.code !== 'ESRCH') console.error(error);
  }
}

function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  pendingExitCode = exitCode;
  for (const child of children) signalChild(child, 'SIGTERM');
  const forced = setTimeout(() => {
    for (const child of children) signalChild(child, 'SIGKILL');
  }, 5_000);
  forced.unref();
  if (children.size === 0) process.exit(pendingExitCode);
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

for (const definition of definitions) {
  console.log(`[TradeNest dev] Starting ${definition.name}`);
  const child = spawn(definition.command, definition.args, {
    cwd: definition.cwd,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    env: process.env,
  });
  children.add(child);
  child.on('error', (error) => {
    console.error(`[TradeNest dev] Failed to launch ${definition.name}: ${error.message}`);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (!stopping) {
      console.error(`[TradeNest dev] ${definition.name} exited (${signal ?? code}). Stopping the other services.`);
      shutdown(code === 0 ? 0 : 1);
    }
    if (children.size === 0) process.exit(pendingExitCode);
  });
}
