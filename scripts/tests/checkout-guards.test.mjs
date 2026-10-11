import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'../..');
test('Checkout source check detects accidental removal of expiration guard',()=>{
  const dir=mkdtempSync(join(tmpdir(),'tradenest-checkout-'));
  try{
    const files=[
      'scripts/verify-checkout.mjs',
      'apps/api/prisma/schema.prisma',
      'apps/api/prisma/migrations/202610080006_checkout_payment_expiration/migration.sql',
      'apps/api/src/modules/orders/checkout.service.ts',
      'apps/api/src/modules/orders/orders.repository.ts',
      'apps/api/src/modules/orders/order-expiration.service.ts',
      'apps/api/src/modules/payments/payments.service.ts',
      'apps/api/src/modules/orders/orders.module.ts',
      'apps/api/scripts/verify-checkout-expiration-runtime.ts',
    ];
    for(const path of files){cpSync(join(root,path),join(dir,path),{recursive:true,force:true});}
    const target=join(dir,'apps/api/src/modules/orders/order-expiration.service.ts');
    writeFileSync(target,readFileSync(target,'utf8').replace("if (payment.externalPending) return 'PROVIDER_PENDING';", "if (payment.externalPending) return 'SKIPPED';"));
    const result=spawnSync(process.execPath,[join(dir,'scripts/verify-checkout.mjs')],{encoding:'utf8'});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/external pending/);
  } finally{rmSync(dir,{recursive:true,force:true});}
});
test('expiration migration preserves nullable legacy dates',()=>{
 const sql=readFileSync(join(root,'apps/api/prisma/migrations/202610080006_checkout_payment_expiration/migration.sql'),'utf8');
 assert.match(sql,/ADD COLUMN "payment_expires_at" TIMESTAMP\(6\);/);
 assert.doesNotMatch(sql,/NOT NULL/);
});
