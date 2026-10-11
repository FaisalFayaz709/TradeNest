import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'tradenest-operations-'));
const envFile = join(temp, 'deploy.env');
const bin = join(temp, 'bin');
mkdirSync(bin);
writeFileSync(envFile, [
  'POSTGRES_USER=tradenest', 'POSTGRES_DB=tradenest',
  'POSTGRES_PASSWORD=not-a-real-test-password',
].join('\n'));
const fake = join(bin, 'docker');
writeFileSync(fake, `#!/usr/bin/env node
const fs = require('node:fs');
const a = process.argv.slice(2);
const cmd = ['pg_dump','pg_restore','createdb','psql'].find(x => a.includes(x));
if (cmd === 'psql') {
  const sql = a[a.indexOf('-c') + 1] || '';
  if (sql.includes('server_version_num')) process.stdout.write(process.env.FAKE_WRONG_PG === '1' ? '170000\\n':'180000\\n');
  else if (sql.includes('FROM pg_database')) process.stdout.write(process.env.FAKE_TARGET_EXISTS === '1' ? '1\\n' : '');
  else if (sql.includes('information_schema.tables')) process.stdout.write('27\\n');
} else if (cmd === 'pg_dump') process.stdout.write(process.env.FAKE_BAD_DUMP === '1' ? 'BADFILE' : 'PGDMP\\u0000FAKE_CUSTOM_PG_DUMP_TEST');
else if (cmd === 'pg_restore') process.stdin.resume();
else if (cmd !== 'createdb') process.exitCode = 1;
`, {mode:0o755});
const localEnv = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
function run(script, args = [], env = {}) {
  return spawnSync(process.execPath, [resolve(root, script), ...args], { cwd: root, encoding:'utf8', env: { ...localEnv, ...env }, timeout:10000 });
}
test.after(() => rmSync(temp, { recursive: true, force: true }));
test('backup fails safely without required arguments', () => {
  const r=run('scripts/ops-backup.mjs');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr,/Usage/);
});
test('backup emits a restricted custom archive and correct SHA manifest', async () => {
  const path=join(temp,'my-first.dump');
  const r=run('scripts/ops-backup.mjs',['--env',envFile,'--output',path]);
  assert.equal(r.status,0,r.stderr);
  assert.ok(readFileSync(path).subarray(0,5).toString()==='PGDMP');
  assert.ok(existsSync(`${path}.manifest.json`));
  const m=JSON.parse(readFileSync(`${path}.manifest.json`,'utf8'));
  assert.equal(m.postgresMajor,18);
  assert.equal(m.bytes,statSync(path).size);
  assert.match(m.sha256,/^[a-f0-9]{64}$/);
  if (process.platform !== 'win32') assert.equal(statSync(path).mode & 0o777, 0o600);
});
test('backup never overwrites an existing archive and rejects wrong PostgreSQL version', () => {
  const path=join(temp,'my-first.dump');
  assert.notEqual(run('scripts/ops-backup.mjs',['--env',envFile,'--output',path]).status,0);
  const p=join(temp,'wrong-version.dump');
  assert.notEqual(run('scripts/ops-backup.mjs',['--env',envFile,'--output',p],{FAKE_WRONG_PG:'1'}).status,0);
  assert.ok(!existsSync(p));
});
test('invalid pg_dump output does not leave a completed backup', () => {
  const path=join(temp,'invalid.dump');
  const r=run('scripts/ops-backup.mjs',['--env',envFile,'--output',path],{FAKE_BAD_DUMP:'1'});
  assert.notEqual(r.status,0);
  assert.ok(!existsSync(path));
  assert.ok(!existsSync(`${path}.manifest.json`));
});
test('restore refuses active or already existing target and missing authorization', () => {
  const backup=join(temp,'my-first.dump');
  const base=['--env',envFile,'--backup',backup];
  assert.notEqual(run('scripts/ops-restore-drill.mjs',[...base,'--target','tradenest','--confirm','RESTORE tradenest']).status,0);
  assert.notEqual(run('scripts/ops-restore-drill.mjs',[...base,'--target','tradenest_drill_recovery','--confirm','yes']).status,0);
  const r=run('scripts/ops-restore-drill.mjs',[...base,'--target','tradenest_drill_recovery','--confirm','RESTORE tradenest_drill_recovery'],{FAKE_TARGET_EXISTS:'1'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/already exists/);
});
test('restore rejects mismatched archive checksum before touching database', () => {
  const p=join(temp,'tamper.dump');
  const backup=join(temp,'my-first.dump');
  writeFileSync(p,Buffer.concat([readFileSync(backup),Buffer.from('x')]));
  writeFileSync(`${p}.manifest.json`,readFileSync(`${backup}.manifest.json`,'utf8').replace('my-first.dump','tamper.dump'));
  const r=run('scripts/ops-restore-drill.mjs',['--env',envFile,'--backup',p,'--target','tradenest_drill_recovery','--confirm','RESTORE tradenest_drill_recovery']);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/checksum\/format mismatch/);
});
test('restore into isolated NEW recovery database verifies restored tables', () => {
  const r=run('scripts/ops-restore-drill.mjs',['--env',envFile,'--backup',join(temp,'my-first.dump'),'--target','tradenest_drill_recovery','--confirm','RESTORE tradenest_drill_recovery']);
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/RESTORE DRILL PASSED/);
});
test('external monitoring refuses unencrypted remote origins and embedded credentials', () => {
  for (const web of ['http://shop.example.org','https://user:password@shop.example.org','https://shop.example.org/checkout']) {
    const r=run('scripts/ops-health-check.mjs',['--web',web,'--api','https://api.example.org']);
    assert.notEqual(r.status,0);
  }
});
test('monitor accepts healthy local endpoints; detects unhealthy readiness', async () => {
  let healthy=true;
  const server=createServer((req,res)=>{
    res.setHeader('content-type','application/json');
    const ready=req.url.endsWith('/ready');
    res.statusCode=healthy?200:503;
    res.end(JSON.stringify({status:ready?(healthy?'ready':'unavailable'):'ok'}));
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  try {
    const port=server.address().port;
    async function check() {
      const args=[resolve(root,'scripts/ops-health-check.mjs'),'--web',`http://127.0.0.1:${port}`,'--api',`http://127.0.0.1:${port}`];
      const child=spawn(process.execPath,args,{cwd:root,stdio:['ignore','pipe','pipe']});
      let stdout='',stderr='';
      child.stdout.on('data',b=>stdout+=b);
      child.stderr.on('data',b=>stderr+=b);
      return new Promise((ok,fail)=>{child.on('error',fail);child.on('close',code=>ok({code,stdout,stderr}));});
    }
    let result=await check();
    assert.equal(result.code,0,result.stderr);
    assert.equal(JSON.parse(result.stdout).status,'healthy');
    healthy=false;
    result=await check();
    assert.equal(result.code,1,result.stderr);
    assert.equal(JSON.parse(result.stdout).status,'critical');
  } finally { await new Promise(ok=>server.close(ok)); }
});
