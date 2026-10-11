import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../..',import.meta.url));
const read = path => readFileSync(resolve(root,path),'utf8');

test('only explicit admin moderation commands; never PATCH arbitrary state',()=>{
 const controller=read('apps/api/src/modules/admin/admin.controller.ts');
 assert.equal((controller.match(/@Post\('(users|sellers|products)\/:id\/(suspend|reactivate)'\)/g)||[]).length,6);
 assert.doesNotMatch(controller,/@Patch\('(users|sellers|products)\/:id/);
});
test('moderation requires reason and rejects extra fields at Zod boundary',()=>{
 const contract=read('packages/contracts/src/admin/moderation.ts');
 assert.match(contract,/\.min\(10\)\.max\(500\)/);
 assert.match(contract,/\.strict\(\)/);
});
test('all moderation endpoints use rate limits, JWT and ADMIN RBAC',()=>{
 const s=read('apps/api/src/modules/admin/admin.controller.ts');
 assert.match(s,/@UseGuards\(AccessTokenGuard, RolesGuard\)[\s\S]*@RequireRoles\('ADMIN'\)/);
 assert.equal((s.match(/@RateLimit\('ADMIN_SENSITIVE_PRINCIPAL'\)/g)||[]).length,6);
 assert.equal((s.match(/@Body\(new ZodValidationPipe\(ModerationReasonSchema\)\)/g)||[]).length,6);
});
test('admin service delegates through bounded module interfaces; no direct Prisma',()=>{
 const s=read('apps/api/src/modules/admin/admin.service.ts');
 assert.match(s,/this\.users\.adminSuspendUser/);
 assert.match(s,/this\.sellers\.adminReactivateSeller/);
 assert.match(s,/this\.catalog\.adminSuspendProduct/);
 assert.doesNotMatch(s,/\bPrismaService\b|\.prisma\b|\.repository\b/);
});
test('user suspension is audited transactionally and blocks administrative peers',()=>{
 const s=read('apps/api/src/modules/users/users.service.ts');
 assert.match(s,/ADMIN_SELF_MODERATION_FORBIDDEN/);
 assert.match(s,/ADMIN_PEER_MODERATION_FORBIDDEN/);
 assert.match(s,/this\.transactions\.runSerializable\(async \(transaction\)/);
 assert.match(s,/this\.repository\.revokeUserSessions\(targetId, transaction\)/);
 assert.match(s,/action: to === 'SUSPENDED' \? 'ADMIN_USER_SUSPEND'/);
});
test('seller moderation does not silently override a suspended user account',()=>{
 const service=read('apps/api/src/modules/seller/seller.service.ts');
 const repo=read('apps/api/src/modules/auth/auth.repository.ts');
 assert.match(service,/SELLER_ACCOUNT_NOT_ACTIVE/);
 assert.match(service,/this\.auth\.isAccountActive\(userId, transaction\)/);
 assert.match(repo,/where: \{ id: userId, status: 'ACTIVE' \}/);
});
test('suspended sellers disappear from public catalog and cannot reserve inventory',()=>{
 const repo=read('apps/api/src/modules/catalog/catalog.repository.ts');
 const service=read('apps/api/src/modules/catalog/catalog.service.ts');
 assert.match(repo,/const PUBLIC_SELLER_POLICY/);
 assert.match(repo,/\.\.\.PUBLIC_SELLER_POLICY/);
 assert.match(service,/await this\.sellers\.requireActiveSeller\(product\.sellerId, transaction\)/);
});
test('product moderation is conditional, audited, and checks seller policy before reactivation',()=>{
 const service=read('apps/api/src/modules/catalog/catalog.service.ts');
 const repo=read('apps/api/src/modules/catalog/catalog.repository.ts');
 assert.match(service,/if \(to === 'ACTIVE'\) await this\.sellers\.requireActiveSeller/);
 assert.match(service,/action: to === 'SUSPENDED' \? 'ADMIN_PRODUCT_SUSPEND'/);
 assert.match(repo,/this\.db\(transaction\)\.product\.updateMany\(\{ where: \{ id, status: from \}/);
});
test('status changes do not create database migration or change locked stack',()=>{
 const pkg=JSON.parse(read('package.json'));
 const spec=read('SPEC_LOCK.yaml');
 assert.equal(pkg.packageManager,'pnpm@10.15.1');
 assert.match(spec,/pattern: "modular monolith"/);
 assert.match(spec,/engine: "PostgreSQL 18"/);
});
test('frontend actions prompt for reasons rather than arbitrary status assignment',()=>{
 const s=read('apps/web/lib/admin-moderation.ts');
 assert.match(s,/window\.prompt/);
 assert.match(s,/window\.confirm/);
 assert.match(s,/clean\.length < 10 \|\| clean\.length > 500/);
 assert.match(s,/jsonData<T>\(`admin\/\$\{kind\}\/\$\{encodeURIComponent\(id\)\}\/\$\{action\}`/);
});
