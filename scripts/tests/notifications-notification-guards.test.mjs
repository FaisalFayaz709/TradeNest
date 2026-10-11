import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../..',import.meta.url));
const s=p=>readFileSync(resolve(root,p),'utf8');
test('required 74 operations remain unchanged; notification routes explicit extensions',()=>{
 const m=JSON.parse(s('scripts/blueprint-endpoints.json'));
 assert.equal(m.required.length,74);
 const v=s('scripts/verify-api-contracts.mjs');
 for(const route of ['GET /notifications','GET /notifications/unread-count','PATCH /notifications/read-all','PATCH /notifications/:parameter/read'])assert.ok(v.includes(route));
});
test('all API reads and updates are filtered by authenticated principal',()=>{
 const service=s('apps/api/src/modules/notifications/notifications.service.ts');
 const repo=s('apps/api/src/modules/notifications/notifications.repository.ts');
 assert.equal((service.match(/principal.userId/g)||[]).length>=5,true);
 assert.match(repo,/where: \{ id, userId, readAt: null \}/);
 assert.match(repo,/where: \{ userId, readAt: null \}/);
 assert.match(repo,/findFirst\(\{ where: \{ id, userId \} \}\)/);
});
test('notification writes must join originating SQL transaction',()=>{
 const service=s('apps/api/src/modules/notifications/notifications.service.ts');
 const repo=s('apps/api/src/modules/notifications/notifications.repository.ts');
 assert.match(service,/if \(!transaction\) throw new Error/);
 assert.match(repo,/transaction.client.notification.createMany/);
 assert.doesNotMatch(repo,/this.prisma.notification.createMany/);
});
test('event key uniquely scoped to event and recipient',()=>{
 const repo=s('apps/api/src/modules/notifications/notifications.repository.ts');
 const migration=s('apps/api/prisma/migrations/202610080009_notification_event_dedup/migration.sql');
 assert.match(repo,/new Set\(event.recipients\)/);
 assert.match(repo,/eventKey: `\$\{event.key\}:\$\{userId\}`/);
 assert.match(repo,/skipDuplicates: true/);
 assert.match(migration,/UNIQUE INDEX/);
});
test('refund notices only after provider verified in same finalization transaction',()=>{
 const s1=s('apps/api/src/modules/escrow/refund-reconciliation.service.ts');
 const p=s1.indexOf('private async finalize(');
 assert.ok(p>=0);
 assert.ok(s1.indexOf('this.refunds.succeeded(',p)<s1.indexOf('this.notifications.record(',p));
 assert.ok(s1.indexOf('this.notifications.record(',p)<s1.indexOf('await this.audit.write(',p));
});
test('frontend does not mark authoritative states or send raw notification HTML',()=>{
 const ui=s('apps/web/app/notifications/page.tsx');
 assert.match(ui,/jsonData\(id \? `notifications\/\$\{id\}\/read` : 'notifications\/read-all', 'PATCH'\)/);
 assert.doesNotMatch(ui,/dangerouslySetInnerHTML|innerHTML/);
});
