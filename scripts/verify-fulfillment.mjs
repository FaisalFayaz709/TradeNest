/** Dependency-free, non-mutating Fulfillment source and migration compliance audit. */
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const read=p=>readFileSync(resolve(root,p),'utf8');
const failures=[];
const schema=read('apps/api/prisma/schema.prisma');
const sql=read('apps/api/prisma/migrations/202610080008_single_shipment_fulfillment_guards/migration.sql');
const shipping=read('apps/api/src/modules/shipping/shipping.service.ts');
const repository=read('apps/api/src/modules/shipping/shipping.repository.ts');
for(const [name,found] of [
 ['Prisma one-to-one shipment',schema.includes('shipment         Shipment?') && schema.includes('@unique(map: "shipments_order_id_key")')],
 ['Prisma required fulfillment fields',schema.includes('carrier      String    @db.VarChar(120)') && schema.includes('shippedAt    DateTime  @map("shipped_at")')],
 ['PostgreSQL uniqueness',sql.includes('CREATE UNIQUE INDEX "shipments_order_id_key"')],
 ['PostgreSQL legal-state check',sql.includes('shipments_valid_state_check')],
 ['Migration does not destroy historical data',!/DELETE\s+FROM\s+(?:"?shipments"?)/i.test(sql)],
 ['Safe identical replay and changed-details conflict',shipping.includes('shipmentReplayMatches(existing, body)') && shipping.includes('SHIPMENT_ALREADY_EXISTS')],
 ['Shipment ownership and transaction',shipping.includes('order.sellerIds.includes(principal.userId)') && shipping.includes('runSerializable')],
 ['Unique repository read',repository.includes('shipment.findUnique({ where: { orderId } })')],
 ['Buyer confirmation idempotency',read('apps/api/src/modules/orders/orders.service.ts').includes("const operation = 'BUYER_CONFIRM_DELIVERY'")],
 ['Dispute outbox remains durable',read('apps/api/src/modules/disputes/disputes.service.ts').includes('this.escrow.resolveDisputeRefund')],
]) if(!found) failures.push(name);
if(failures.length){console.error('FULFILLMENT STATIC CHECK FAILED'); for(const f of failures) console.error('-',f);process.exit(1);}
console.log('FULFILLMENT STATIC CHECK PASSED: 10 workflow and database invariants (not live functional acceptance).');
