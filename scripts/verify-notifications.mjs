/** Source verification only. Live Postgres 18/NestJS tests are a separate acceptance gate. */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const get=p=>readFileSync(resolve(root,p),'utf8');
const c=(label,path,pattern)=>[label,existsSync(resolve(root,path))&&pattern.test(get(path))];
const checks=[
 c('existing Notification model with event dedup uniqueness','apps/api/prisma/schema.prisma',/model Notification[\s\S]*eventKey\s+String\?\s+@unique/),
 c('additive unique-index migration','apps/api/prisma/migrations/202610080009_notification_event_dedup/migration.sql',/CREATE UNIQUE INDEX "notifications_event_key_key"/),
 c('transaction-scoped createMany with duplicate guard','apps/api/src/modules/notifications/notifications.repository.ts',/transaction.client.notification.createMany\([\s\S]*skipDuplicates: true/),
 c('read never selects other users','apps/api/src/modules/notifications/notifications.repository.ts',/updateMany\(\{ where: \{ id, userId, readAt: null \}/),
 c('read-all never selects other users','apps/api/src/modules/notifications/notifications.repository.ts',/updateMany\(\{ where: \{ userId, readAt: null \}/),
 c('unread filtering by user','apps/api/src/modules/notifications/notifications.repository.ts',/where: \{ userId, \.\.\.\(unreadOnly/),
 c('all HTTP read/write guarded JWT/RBAC','apps/api/src/modules/notifications/notifications.controller.ts',/@UseGuards\(AccessTokenGuard, RolesGuard\)[\s\S]*@RequireRoles\('BUYER', 'SELLER', 'ADMIN'\)/),
 c('shared Zod contract','packages/contracts/src/notifications/index.ts',/NotificationSchema = z.object/),
 c('module publishes explicit API','apps/api/src/modules/notifications/notifications.module.ts',/provide: NOTIFICATIONS_MODULE_API/),
 c('payment success emits in tx','apps/api/src/modules/payments/payments.service.ts',/notifications.record\(\{ key: `PAYMENT_SUCCEEDED:[\s\S]*\}, transaction\)/),
 c('dispute notification after escrow hold','apps/api/src/modules/disputes/disputes.service.ts',/markDisputed\(orderId, transaction\)[\s\S]*notifications.record/),
 c('refund event inside finalize transaction','apps/api/src/modules/escrow/refund-reconciliation.service.ts',/refunds.succeeded\(id, attempts, providerRefundId, tx\)[\s\S]*notifications.record/),
 c('order created inside checkout transaction','apps/api/src/modules/orders/checkout.service.ts',/this.notifications.record\(\{ key: `ORDER_PLACED:/),
 c('shipping notification within transition transaction','apps/api/src/modules/shipping/shipping.service.ts',/markSellerShipped\(orderId, transaction\)[\s\S]*notifications.record/),
 c('admin moderation emits in tx','apps/api/src/modules/users/users.service.ts',/ACCOUNT_MODERATED[\s\S]*\}, transaction\)/),
 c('buyer/seller/admin notification UI','apps/web/app/notifications/page.tsx',/Mark all read/),
];
const failed=checks.filter(([,ok])=>!ok);
for(const [label,ok] of checks)console.log(`${ok?'OK':'FAIL'}: ${label}`);
if(failed.length){console.error(`NOTIFICATIONS static FAILURE: ${failed.length} issues`);process.exitCode=1}
else console.log(`NOTIFICATIONS static checks: ${checks.length}/${checks.length} passed; runtime acceptance still required.`);
