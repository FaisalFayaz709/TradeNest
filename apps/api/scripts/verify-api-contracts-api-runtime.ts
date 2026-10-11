/**
 * API CONTRACTS: real NestJS/OpenAPI/HTTP contract verification against an isolated test DB.
 * Run ONLY after scripts/verify-database-target.mjs approves TEST_DATABASE_URL.
 * Creates three unique test users and an address; never use on shared/prod DB.
 */
import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module.js';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter.js';
import { requestIdMiddleware } from '../src/common/http/request-id.js';

interface ApiResult { status: number; body: any; headers: Headers }

const rawUrl = process.env.TEST_DATABASE_URL;
if (!rawUrl || process.env.DATABASE_URL !== rawUrl) throw new Error('DATABASE_URL must equal TEST_DATABASE_URL.');
const target = new URL(rawUrl);
if (target.protocol !== 'postgresql:' && target.protocol !== 'postgres:') throw new Error('PostgreSQL test database required.');
if (!['127.0.0.1','localhost','::1','[::1]'].includes(target.hostname)) throw new Error('Refusing non-local database.');
if (!/^tradenest(?:_[a-z0-9]+)*_test$/.test(target.pathname.slice(1))) throw new Error('Refusing non-test database.');
if (target.searchParams.get('schema') !== 'public') throw new Error('Only isolated public test schemas are allowed.');
if (process.env.NODE_ENV !== 'test') throw new Error('NODE_ENV must be test.');
const spec = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/blueprint-endpoints.json'), 'utf8')) as {
  required: {method: string;path: string;access: string}[];
};
const normalize = (path: string) => path.replace(/\{[^}]+\}/g, ':param').replace(/:[\w]+/g, ':param');
const app = await NestFactory.create(AppModule, {rawBody: true, logger: false});
app.setGlobalPrefix('api/v1');
app.use(requestIdMiddleware);
app.useGlobalFilters(new ApiExceptionFilter());
const swagger = SwaggerModule.createDocument(app,
  new DocumentBuilder().setTitle('TradeNest API').setVersion('1.0')
    .addBearerAuth({type: 'http', scheme: 'bearer', bearerFormat: 'JWT'}, 'bearer').build());

let checks=0;
for (const entry of spec.required) {
  const foundPath = Object.keys(swagger.paths).find(p => normalize(p) === normalize('/api/v1'+entry.path));
  assert.ok(foundPath, `OpenAPI missing ${entry.method} ${entry.path}`);
  const operation = swagger.paths[foundPath]?.[entry.method.toLowerCase() as 'get'|'post'|'patch'|'delete'];
  assert.ok(operation, `OpenAPI missing operation ${entry.method} ${entry.path}`);
  const security = operation?.security ?? [];
  if (['PUBLIC','OPTIONAL','WEBHOOK'].includes(entry.access)) {
    assert.equal(security.length, 0, `Public/optional/provider OpenAPI route incorrectly requires bearer: ${entry.path}`);
  } else {
    assert.ok(security.some(o => Object.hasOwn(o, 'bearer')), `Protected OpenAPI operation missing bearer scheme: ${entry.path}`);
  }
  checks++;
}

let base='';
async function call(method: string, path: string, body?: unknown, token?: string): Promise<ApiResult> {
  const headers: Record<string,string> = { 'x-request-id': 'api contracts-runtime-test', 'content-type': 'application/json' };
  if (token) headers.authorization=`Bearer ${token}`;
  const response = await fetch(base+'/api/v1'+path, {
    method, headers, signal: AbortSignal.timeout(10_000), ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  const json = await response.json();
  return {status:response.status,body:json,headers:response.headers};
}
async function check(method: string, path: string, expected: number, body?: unknown, token?: string) {
  const result=await call(method,path,body,token);
  assert.equal(result.status,expected,`${method} ${path}: expected ${expected}; got ${result.status} ${JSON.stringify(result.body)}`);
  assert.equal(result.headers.get('x-request-id'), 'api contracts-runtime-test');
  if (expected>=400) {
    assert.equal(typeof result.body?.error?.code, 'string');
    assert.equal(result.body?.error?.requestId, 'api contracts-runtime-test');
  } else assert.ok(Object.hasOwn(result.body,'data'),`${method} ${path}: missing success data envelope`);
  checks++;
  return result.body;
}
try {
  await app.listen(0,'127.0.0.1');
  const addr = app.getHttpServer().address();
  if (!addr || typeof addr === 'string') throw new Error('Could not determine listening port.');
  base = `http://127.0.0.1:${addr.port}`;

  // Every required protected endpoint must refuse a missing Bearer token, before touching data.
  for (const e of spec.required) {
    if (['PUBLIC','OPTIONAL','WEBHOOK'].includes(e.access)) continue;
    const url=e.path.replace(/:[A-Za-z]+/g, randomUUID());
    await check(e.method,url,401);
  }
  await check('GET','/categories',200);
  await check('GET','/products',200);
  await check('GET','/products/NOT_A_SLUG!',400);
  await check('POST','/payments/webhooks/INVALID@PROVIDER',400,{});
  await check('POST','/events',400,{}); // Optional authentication, required Zod body
  await check('POST','/auth/register',400,{name:'Admin',email:'fake-'+randomUUID()+'@example.test',password:'Safe1234!Safe1234!',role:'ADMIN'});
  await check('POST','/auth/login',400,{email:'not-an-email',password:'Safe1234!Safe1234!'});

  const passwd='Pass3StrongPassword!2026';
  const postfix=randomUUID().replace(/-/g,'');
  const buyer=await check('POST','/auth/register',201,{name:'Buyer P3',email:`api contracts-b-${postfix}@example.test`,password:passwd,role:'BUYER'});
  const another=await check('POST','/auth/register',201,{name:'Other P3',email:`api contracts-o-${postfix}@example.test`,password:passwd,role:'BUYER'});
  const seller=await check('POST','/auth/register',201,{name:'Seller P3',email:`api contracts-s-${postfix}@example.test`,password:passwd,role:'SELLER'});
  const b=buyer.data.tokens.accessToken as string;
  const o=another.data.tokens.accessToken as string;
  const s=seller.data.tokens.accessToken as string;
  await check('GET','/users/me',200,undefined,b);
  await check('GET','/seller/profile',403,undefined,b);
  await check('GET','/admin/dashboard',403,undefined,s);
  await check('GET','/cart',403,undefined,s);
  const address=await check('POST','/users/me/addresses',201,{recipient:'Buyer Test',line1:'101 Test Road',city:'Testville',country:'US'},b);
  const id=address.data.id;
  await check('PATCH',`/users/me/addresses/${id}`,404,{city:'Forbidden'},o);
  await check('DELETE',`/users/me/addresses/${id}`,404,undefined,o);
  await check('PATCH',`/users/me/addresses/${id}`,200,{city:'Updated City'},b);
  await check('DELETE',`/users/me/addresses/${id}`,200,undefined,b);
  const renewed=await check('POST','/auth/refresh',200,{refreshToken:buyer.data.tokens.refreshToken});
  await check('POST','/auth/refresh',401,{refreshToken:buyer.data.tokens.refreshToken});
  await check('GET','/auth/me',200,undefined,renewed.data.tokens.accessToken);
  await check('POST','/auth/logout-all',200,undefined,renewed.data.tokens.accessToken);
  await check('GET','/auth/me',401,undefined,renewed.data.tokens.accessToken);
  console.log(`API CONTRACTS LIVE API PASSED: ${checks} OpenAPI/HTTP checks, isolation, RBAC, tokens, refresh rotation, request validation and error envelopes.`);
} finally {
  await app.close();
}
