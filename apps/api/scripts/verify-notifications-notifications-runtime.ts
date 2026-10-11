/** Notifications live test: ONLY isolated localhost PostgreSQL 18 *_test database.
 * Exercises actual NestJS HTTP/JWT authorization and DB transaction isolation.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { Client } from 'pg';
import { AppModule } from '../src/app.module.js';
import { NotificationsService } from '../src/modules/notifications/notifications.service.js';
import { DatabaseTransactionService } from '../src/database/database-transaction.service.js';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter.js';
import { requestIdMiddleware } from '../src/common/http/request-id.js';

const url=process.env.TEST_DATABASE_URL;
if (!url || process.env.DATABASE_URL !== url || process.env.NODE_ENV !== 'test') throw new Error('Isolated TEST_DATABASE_URL and NODE_ENV=test are required.');
const parsed=new URL(url);
if (!['postgres:','postgresql:'].includes(parsed.protocol) ||
    !['127.0.0.1','localhost','[::1]'].includes(parsed.hostname) ||
    !/^tradenest(?:_[a-z0-9]+)*_test$/.test(parsed.pathname.slice(1)) ||
    parsed.searchParams.get('schema') !== 'public') throw new Error('Refusing non-local / non-test database.');
const pg=new Client({connectionString:url});
await pg.connect();
const pgVersion=await pg.query<{n:number}>("SELECT current_setting('server_version_num')::int AS n");
assert.ok(pgVersion.rows[0]!.n>=180000&&pgVersion.rows[0]!.n<190000,'PostgreSQL 18 required');
const app=await NestFactory.create(AppModule,{logger:false,rawBody:true});
app.setGlobalPrefix('api/v1');app.use(requestIdMiddleware);app.useGlobalFilters(new ApiExceptionFilter());
let base='';let checks=0;
const users:string[]=[];
async function http(method:string,path:string,expected:number,token?:string,body?:unknown) {
  const res=await fetch(`${base}/api/v1${path}`,{method,
    headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
  const result=await res.json() as {data?:any;meta?:any;error?:any};
  assert.equal(res.status,expected,`${method} ${path} status ${res.status}: ${JSON.stringify(result)}`);
  checks++;return result;
}
try {
  await app.listen(0,'127.0.0.1');
  const bound=app.getHttpServer().address();
  if(!bound||typeof bound==='string')throw new Error('Missing local bind port');
  base=`http://127.0.0.1:${bound.port}`;
  const suffix=randomUUID().replace(/-/g,'');
  const pw='Pass10Secure!2026';
  async function register(label:string){
    const data=(await http('POST','/auth/register',201,undefined,{name:`Notifications ${label}`,email:`notifications-${label}-${suffix}@example.test`,password:pw,role:'BUYER'})).data;
    users.push(data.user.id);
    return {id:data.user.id as string,token:data.tokens.accessToken as string};
  }
  const a=await register('a'),b=await register('b');
  const service=app.get(NotificationsService);
  const transactions=app.get(DatabaseTransactionService);
  const id=randomUUID();
  const event={key:`ORDER_PLACED:${id}`,type:'ORDER_PLACED' as const,title:'Order placed',body:'Your order awaits verified payment.',recipients:[a.id,b.id,a.id]};
  await transactions.runSerializable(async tx=>{await service.record(event,tx);});
  await transactions.runSerializable(async tx=>{await service.record(event,tx);});
  const c=await pg.query<{n:number}>('SELECT count(*)::int AS n FROM notifications WHERE event_key LIKE $1',[`ORDER_PLACED:${id}:%`]);
  assert.equal(c.rows[0]!.n,2,'Exactly one notification per recipient after duplicate event');checks++;
  const rollbackId=randomUUID();
  await assert.rejects(transactions.runSerializable(async tx=>{
    await service.record({...event,key:`ORDER_PLACED:${rollbackId}`},tx);
    throw new Error('intentional rollback');
  }));
  const rolled=await pg.query<{n:number}>('SELECT count(*)::int AS n FROM notifications WHERE event_key LIKE $1',[`ORDER_PLACED:${rollbackId}:%`]);
  assert.equal(rolled.rows[0]!.n,0,'No persisted notifications after rollback');checks++;
  await http('GET','/notifications',401);
  const forA=(await http('GET','/notifications?page=1&limit=20',200,a.token)).data;
  const forB=(await http('GET','/notifications?unreadOnly=true',200,b.token)).data;
  assert.ok(forA.some((row:any)=>row.type==='ORDER_PLACED'));
  const noticeA=forA.find((row:any)=>row.type==='ORDER_PLACED');
  const noticeB=forB.find((row:any)=>row.type==='ORDER_PLACED');
  assert.ok(noticeB);
  await http('PATCH',`/notifications/${noticeB.id}/read`,404,a.token);
  const unreadB=(await http('GET','/notifications/unread-count',200,b.token)).data.count;
  assert.equal(unreadB,1,'Another user cannot mark notifications read');
  await http('PATCH',`/notifications/${noticeA.id}/read`,200,a.token);
  assert.equal((await http('GET','/notifications/unread-count',200,a.token)).data.count,0);
  await http('PATCH','/notifications/read-all',200,b.token);
  assert.equal((await http('GET','/notifications/unread-count',200,b.token)).data.count,0);
  await http('PATCH',`/notifications/not-uuid/read`,400,b.token);
  console.log(`NOTIFICATIONS LIVE NOTIFICATIONS PASSED: ${checks} requests/integrity checks, rollback, recipient dedup, user ownership`);
} finally {
  await app.close().catch(()=>undefined);
  // Test-created accounts only: notifications and sessions cascade from these accounts.
  if(users.length)await pg.query('DELETE FROM users WHERE id = ANY($1::uuid[])',[users]).catch(error=>console.warn('Test user cleanup requires manual review:',String(error)));
  await pg.end();
}
