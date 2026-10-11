import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const files = [
  'apps/api/src/common/storage/storage.service.ts',
  'packages/contracts/src/products/product.ts',
  'apps/api/src/modules/catalog/catalog.service.ts',
  'apps/api/src/modules/catalog/catalog.repository.ts',
  'apps/api/src/modules/disputes/disputes.service.ts',
  'apps/web/app/seller/products/page.tsx',
  'apps/web/app/orders/[id]/order-detail-client.tsx',
  'apps/web/app/seller/disputes/[id]/seller-dispute-detail-client.tsx',
  'apps/web/app/api/tradenest/[...path]/route.ts',
  'apps/api/prisma/migrations/202610080005_managed_upload_object_uniqueness/migration.sql',
];
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'tradenest-storage-'));
  mkdirSync(join(dir,'scripts'), {recursive:true});
  cpSync(resolve(root,'scripts/verify-storage.mjs'), join(dir,'scripts/verify-storage.mjs'));
  for (const file of files) {
    mkdirSync(join(dir,file.split('/').slice(0,-1).join('/')), {recursive:true});
    cpSync(resolve(root,file), join(dir,file));
  }
  return dir;
}
function run(dir) { return spawnSync(process.execPath,[join(dir,'scripts/verify-storage.mjs')],{encoding:'utf8'}); }
test('baseline managed upload source security audit', () => {
  const dir=fixture();try {const r=run(dir); assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/19 security\/integration invariants/);}finally {rmSync(dir,{recursive:true,force:true});}
});
for (const [label, file, from, to] of [
  ['rejects removed owner-scoped object validation','apps/api/src/common/storage/storage.service.ts', 'validateObjectKey(kind, resourceId, actorId, objectKey);','// disabled provenance check'],
  ['rejects removed S3 upload existence checks','apps/api/src/common/storage/storage.service.ts','new HeadObjectCommand','new UncheckedHeadCommand'],
  ['rejects missing evidence participant checks','apps/api/src/modules/disputes/disputes.service.ts',`this.requireParticipantOrAdmin(principal, dispute);\n    if (dispute.status !== 'OPEN')`,`// bypass policy\n    if (dispute.status !== 'OPEN')`],
  ['rejects direct URL registration without object verification','apps/api/src/modules/catalog/catalog.service.ts',"this.storage.verify('products', id, principal.userId, input.objectKey)",'Promise.resolve()'],
  ['rejects unexpected removal of short-lived evidence links','apps/api/src/common/storage/storage.service.ts',"expiresIn: 120","expiresIn: 36000"],
]) {
  test(label, () => {const dir=fixture();try {
    const path=join(dir,file),source=readFileSync(path,'utf8');assert.ok(source.includes(from));writeFileSync(path,source.replace(from,to));
    const r=run(dir);assert.notEqual(r.status,0);assert.match(r.stderr,/STORAGE SOURCE CHECK FAILED/);
  }finally {rmSync(dir,{recursive:true,force:true});}});
}
