/**
 * Admin live NestJS + PostgreSQL 18 moderation acceptance.
 * Refuses all databases except isolated localhost *_test; creates disposable fixtures.
 * Never run on a shared or production DB. No payment or upload provider is used.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { Client } from 'pg';
import { AppModule } from '../src/app.module.js';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter.js';
import { requestIdMiddleware } from '../src/common/http/request-id.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || process.env.DATABASE_URL !== url || process.env.NODE_ENV !== 'test') {
  throw new Error('Use NODE_ENV=test and DATABASE_URL=TEST_DATABASE_URL pointing at an isolated database.');
}
const parsed = new URL(url);
if (!['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !['127.0.0.1','localhost','[::1]'].includes(parsed.hostname) ||
    !/^tradenest(?:_[a-z0-9]+)*_test$/.test(parsed.pathname.slice(1)) ||
    parsed.searchParams.get('schema') !== 'public') {
  throw new Error('Admin requires a localhost tradenest_*_test database and schema=public.');
}
const database = new Client({ connectionString: url });
await database.connect();
const server = await database.query<{ version: number }>(`SELECT current_setting('server_version_num')::int AS version`);
assert.ok(server.rows[0]!.version >= 180000 && server.rows[0]!.version < 190000, 'PostgreSQL 18 required');
const app = await NestFactory.create(AppModule, { rawBody: true, logger: false });
app.setGlobalPrefix('api/v1');
app.use(requestIdMiddleware);
app.useGlobalFilters(new ApiExceptionFilter());
let base = '';
let checks = 0;
async function request(method: string, path: string, expected: number, token?: string, body?: unknown) {
  const response = await fetch(`${base}/api/v1${path}`, {
    method, headers: { 'content-type':'application/json', ...(token ? { authorization:`Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json() as { data?: any; error?: { code: string } };
  assert.equal(response.status,expected,`${method} ${path}: ${response.status}, ${JSON.stringify(result)}`);
  if (expected >= 400) assert.ok(result.error?.code);
  checks++;
  return result;
}
const password = 'Pass9SafePassword!2026';
const postfix = randomUUID().replace(/-/g,'');
async function register(role: 'BUYER'|'SELLER', kind: string) {
  return (await request('POST','/auth/register',201,undefined,{
    name:`Admin ${kind}`, email:`admin-${kind}-${postfix}@example.test`, password, role,
  })).data;
}
try {
  await app.listen(0,'127.0.0.1');
  const addr = app.getHttpServer().address();
  if (!addr || typeof addr === 'string') throw new Error('Could not determine port');
  base = `http://127.0.0.1:${addr.port}`;
  const adminAccount = await register('BUYER','admin');
  const buyerAccount = await register('BUYER','buyer');
  const sellerAccount = await register('SELLER','seller');
  const peerAccount = await register('BUYER','peer');
  const bannedAccount = await register('BUYER','banned');
  const adminId = adminAccount.user.id as string;
  const buyerId = buyerAccount.user.id as string;
  const sellerId = sellerAccount.user.id as string;
  const peerId = peerAccount.user.id as string;
  const bannedId = bannedAccount.user.id as string;
  // Test-only administrative fixture setup; never exposed by production API.
  await database.query(`UPDATE users SET role='ADMIN' WHERE id IN ($1,$2)`,[adminId,peerId]);
  await database.query(`UPDATE users SET status='BANNED' WHERE id=$1`,[bannedId]);
  const adminLogin = await request('POST','/auth/login',200,undefined,{
    email:`admin-admin-${postfix}@example.test`,password,
  });
  const admin = adminLogin.data.tokens.accessToken as string;
  const buyer = buyerAccount.tokens.accessToken as string;
  const seller = sellerAccount.tokens.accessToken as string;
  const reason = 'Test-only policy violation requiring moderation';
  await request('POST',`/admin/users/${buyerId}/suspend`,403,buyer,{reason});
  await request('POST',`/admin/users/${adminId}/suspend`,403,admin,{reason});
  await request('POST',`/admin/users/${peerId}/suspend`,403,admin,{reason});
  await request('POST',`/admin/users/${bannedId}/reactivate`,409,admin,{reason});
  await request('POST',`/admin/users/${buyerId}/suspend`,400,admin,{reason:'short'});
  const firstBuyerSuspension = await request('POST',`/admin/users/${buyerId}/suspend`,201,admin,{reason});
  assert.equal(firstBuyerSuspension.data.status,'SUSPENDED');
  await request('GET','/users/me',401,buyer);
  await request('POST',`/admin/users/${buyerId}/suspend`,409,admin,{reason});
  const buyerReactivated = await request('POST',`/admin/users/${buyerId}/reactivate`,201,admin,{reason});
  assert.equal(buyerReactivated.data.status,'ACTIVE');
  await request('GET','/users/me',401,buyer); // sessions revoked on suspension
  await request('POST','/auth/login',200,undefined,{email:`admin-buyer-${postfix}@example.test`,password});
  const onboarded = await request('POST','/seller/onboard',201,seller,{storeName:`Admin Shop ${postfix.slice(0,7)}`});
  assert.equal(onboarded.data.status,'ACTIVE');
  const category = (await request('POST','/categories',201,admin,{name:`Admin Category ${postfix.slice(0,7)}`})).data;
  const product = (await request('POST','/products',201,seller,{
    categoryId:category.id,name:'Admin Moderated Product',description:'A test product with a valid description for moderation.',price:13,stock:10,sku:'ADMIN-TST',
  })).data;
  await request('POST',`/products/${product.id}/publish`,201,seller);
  await request('GET',`/products/${product.slug}`,200);
  await request('POST',`/admin/sellers/${sellerId}/suspend`,201,admin,{reason});
  await request('GET',`/products/${product.slug}`,404);
  await request('PATCH',`/products/${product.id}`,403,seller,{price:14}); // suspended seller cannot edit
  await request('POST',`/admin/products/${product.id}/suspend`,201,admin,{reason});
  await request('POST',`/admin/products/${product.id}/reactivate`,403,admin,{reason}); // seller must be ACTIVE
  await request('POST',`/admin/sellers/${sellerId}/reactivate`,201,admin,{reason});
  await request('POST',`/admin/products/${product.id}/reactivate`,201,admin,{reason});
  await request('GET',`/products/${product.slug}`,200);
  const audits = await database.query<{ action: string; reason: string }>(`SELECT action,metadata->>'reason' AS reason FROM audit_logs WHERE actor_id=$1 AND entity_id IN ($2,$3,$4)`,[adminId,buyerId,sellerId,product.id]);
  const actions = new Set(audits.rows.map(row=>row.action));
  for (const row of audits.rows) if (row.action.startsWith('ADMIN_')) assert.equal(row.reason,reason);
  for (const action of ['ADMIN_USER_SUSPEND','ADMIN_USER_REACTIVATE','ADMIN_SELLER_SUSPEND','ADMIN_SELLER_REACTIVATE','ADMIN_PRODUCT_SUSPEND','ADMIN_PRODUCT_REACTIVATE']) {
    assert.ok(actions.has(action),`Missing audit record ${action}`);
  }
  console.log(`ADMIN LIVE API PASSED: ${checks} HTTP checks plus 6 persisted audit actions`);
} finally {
  await app.close().catch(() => undefined);
  await database.end();
}
