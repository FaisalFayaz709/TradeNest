import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shipmentReplayMatches, mayCreateShipment, mayConfirmDelivery } from '../../apps/api/src/modules/shipping/shipment-policy.ts';
import { assertLocalTestDatabaseUrl } from '../../apps/api/scripts/fulfillment-test-database-guard.ts';
const source=(path)=>readFileSync(new URL(`../../${path}`, import.meta.url),'utf8');

test('only PAID/PROCESSING orders with HELD escrow may be shipped',()=>{
  for (const state of ['PAID','PROCESSING']) assert.equal(mayCreateShipment(state,'HELD'),true);
  for (const state of ['PENDING_PAYMENT','CANCELLED','DISPUTED','REFUNDED','SHIPPED','COMPLETED'])
    assert.equal(mayCreateShipment(state,'HELD'),false);
  for (const escrow of ['PENDING','SELLER_SHIPPED','UNDER_REVIEW','DISPUTED','RELEASED','REFUNDED',null])
    assert.equal(mayCreateShipment('PAID',escrow),false);
});
test('delivery confirmation requires shipped order/parcel, seller-shipped escrow and no active dispute',()=>{
  assert.equal(mayConfirmDelivery('SHIPPED','SHIPPED','SELLER_SHIPPED',false),true);
  for(const condition of [
    ['CANCELLED','SHIPPED','SELLER_SHIPPED',false],
    ['SHIPPED','DELIVERED','SELLER_SHIPPED',false],
    ['SHIPPED','SHIPPED','RELEASED',false],
    ['SHIPPED','SHIPPED','SELLER_SHIPPED',true],
  ]) assert.equal(mayConfirmDelivery(...condition),false);
});
test('shipment replay returns previous record only when tracking details match exactly',()=>{
  const saved={carrier:'Trusted Carrier',trackingCode:'TRACK-1'};
  assert.equal(shipmentReplayMatches(saved,{...saved}),true);
  assert.equal(shipmentReplayMatches(saved,{...saved,trackingCode:'TRACK-2'}),false);
  assert.equal(shipmentReplayMatches(saved,{...saved,carrier:'Other Carrier'}),false);
});
test('Fulfillment migration fails closed on duplicate shipment rows and enforces legal states',()=>{
  const sql=source('apps/api/prisma/migrations/202610080008_single_shipment_fulfillment_guards/migration.sql');
  for(const marker of ['PASS8_DUPLICATE_SHIPMENTS_REQUIRES_MANUAL_RECONCILIATION','PASS8_INVALID_SHIPMENT_STATE_REQUIRES_MANUAL_RECONCILIATION','CREATE UNIQUE INDEX "shipments_order_id_key"','shipments_valid_state_check',"'DELIVERED'", "'SHIPPED'"]) assert.ok(sql.includes(marker),marker);
  assert.equal(/DELETE\s+FROM\s+shipments/i.test(sql),false);
});
test('shipping repository uses unique Prisma lookup rather than picking an arbitrary shipment',()=>{
  const s=source('apps/api/src/modules/shipping/shipping.repository.ts');
  assert.ok(s.includes('shipment.findUnique({ where: { orderId } })'));
  assert.equal(s.includes('shipment.findFirst('),false);
});
test('shipment create retains ownership and serializable financial coupling',()=>{
  const s=source('apps/api/src/modules/shipping/shipping.service.ts');
  for(const marker of ['runSerializable','order.sellerIds.includes(principal.userId)','shipmentReplayMatches(existing, body)','SHIPMENT_ALREADY_EXISTS','this.orders.markShippedFromShipment','this.escrow.markSellerShipped']) assert.ok(s.includes(marker),marker);
});
test('cancellation is pending-payment-only and refuses outstanding provider payment',()=>{
  const s=source('apps/api/src/modules/orders/orders.service.ts');
  for(const marker of ["assertOrderTransition(order.status, 'CANCELLED', ['PENDING_PAYMENT'])",'payment.externalPending','releaseInventoryReservation','runSerializable']) assert.ok(s.includes(marker),marker);
});
test('dispute opening and resolution block illegal transitions and require authorized actors',()=>{
  const s=source('apps/api/src/modules/disputes/disputes.service.ts');
  for(const marker of ["requireRole(principal, ['BUYER'])","['PAID', 'PROCESSING', 'SHIPPED']",'order.sellerIds.length !== 1',"['HELD', 'SELLER_SHIPPED']",'this.orders.markDisputedFromDispute','this.escrow.markDisputed',"requireRole(principal, ['ADMIN'])",'this.escrow.resolveDisputeRefund','this.escrow.resolveDisputeRelease']) assert.ok(s.includes(marker),marker);
});
test('verified-order reviews require buyer ownership, completion and DB unique key',()=>{
  const s=source('apps/api/src/modules/orders/reviews.service.ts');
  const schema=source('apps/api/prisma/schema.prisma');
  for(const marker of ["requireRole(principal, ['BUYER'])","purchase.buyerId !== principal.userId", "purchase.status !== 'COMPLETED'",'REVIEW_ALREADY_EXISTS']) assert.ok(s.includes(marker),marker);
  assert.ok(schema.includes('orderItemId String   @unique'));
});
test('database integration verifier refuses remote, non-test or absent databases',()=>{
  for(const url of [undefined,'postgresql://localhost:5432/tradenest','postgresql://prod.example.com:5432/tradenest_test','postgresql://localhost:5432/tradenest_prod'])
    assert.throws(()=>assertLocalTestDatabaseUrl(url),/DATABASE_URL|TEST_DATABASE_GUARD/);
  assert.doesNotThrow(()=>assertLocalTestDatabaseUrl('postgresql://127.0.0.1:5432/tradenest_test'));
});
