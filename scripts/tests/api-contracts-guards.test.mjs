import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../..',import.meta.url));
function fixture() {
  const dest=mkdtempSync(join(tmpdir(),'tradenest-api contracts-'));
  mkdirSync(join(dest,'scripts'),{recursive:true});
  cpSync(resolve(root,'scripts/blueprint-endpoints.json'),join(dest,'scripts/blueprint-endpoints.json'));
  cpSync(resolve(root,'scripts/verify-api-contracts.mjs'),join(dest,'scripts/verify-api-contracts.mjs'));
  cpSync(resolve(root,'apps/api/src/modules'),join(dest,'apps/api/src/modules'),{recursive:true});
  return dest;
}
function verify(dest) {
  return spawnSync(process.execPath,[join(dest,'scripts/verify-api-contracts.mjs')],{encoding:'utf8'});
}
function mutate(dest, path, original, replacement) {
  const file=join(dest,path);
  const src=readFileSync(file,'utf8');
  assert.ok(src.includes(original),`fixture missing marker ${original}`);
  writeFileSync(file,src.replace(original,replacement));
}
function negative(label, path, original, replacement, expectedError) {
  test(label,()=>{
    const dest=fixture();
    try {
      mutate(dest,path,original,replacement);
      const result=verify(dest);
      assert.notEqual(result.status,0,'security regression should cause failure');
      assert.match(result.stderr,expectedError);
    } finally {rmSync(dest,{recursive:true,force:true});}
  });
}
test('baseline source has all 74 required routes and 19 approved extras',()=>{
  const dest=fixture();
  try {
    const result=verify(dest);
    assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,/74\/74 blueprint routes; 19 extension endpoints/);
  } finally {rmSync(dest,{recursive:true,force:true});}
});
negative('missing required route is detected',
 'apps/api/src/modules/auth/auth.controller.ts',"@Post('register')","@Post('different')",/Missing required blueprint operation/);
negative('missing route authentication fails closed',
 'apps/api/src/modules/users/users.controller.ts', '@UseGuards(AccessTokenGuard)','@UseGuards()',/required AccessTokenGuard is missing/);
negative('Swagger bearer metadata regression is detected',
 'apps/api/src/modules/admin/admin.controller.ts','@ApiBearerAuth()','',/Swagger bearer metadata is missing/);
negative('missing sensitive route RBAC metadata fails closed',
 'apps/api/src/modules/admin/admin.controller.ts',"@RequireRoles('ADMIN')",'',/RBAC roles/);
negative('unvalidated dynamic route parameter fails closed',
 'apps/api/src/modules/catalog/products.controller.ts',"@Param('slug', new ZodValidationPipe(ProductSlugSchema))","@Param('slug')",/unvalidated route parameter/);
negative('unvalidated request body fails closed',
 'apps/api/src/modules/auth/auth.controller.ts','@Body(new ZodValidationPipe(RegisterSchema))','@Body()',/request body has no Zod/);
negative('public routes must not suddenly require bearer security',
 'apps/api/src/modules/analytics/events.controller.ts','@UseGuards(OptionalAccessTokenGuard, RateLimitGuard)','@UseGuards(AccessTokenGuard, RateLimitGuard)',/optional-token event route/);
