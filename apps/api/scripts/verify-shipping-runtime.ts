import 'dotenv/config';
import { randomUUID } from 'node:crypto';

process.env.DATABASE_URL ??= 'postgresql://tradenest:tradenest_local_only@127.0.0.1:5432/tradenest?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'shipping-runtime-jwt-secret-at-least-32-characters';

const { ShippingService } = await import('../src/modules/shipping/shipping.service.js');
const { AuthorizationService } = await import('../src/common/authorization/authorization.service.js');
const { ApiException } = await import('../src/common/http/api-exception.js');

const BUYER_ID = '10000000-0000-4000-8000-000000000001';
const SELLER_ID = '10000000-0000-4000-8000-000000000002';
const OTHER_SELLER_ID = '10000000-0000-4000-8000-000000000003';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const SHIPMENT_ID = '30000000-0000-4000-8000-000000000001';
const now = new Date('2026-10-05T12:00:00.000Z');

const principal = (userId: string, role: 'BUYER' | 'SELLER' | 'ADMIN') => ({
  userId, sessionId: randomUUID(), email: `${role.toLowerCase()}@example.invalid`, name: role, role,
});

function assertApiError(error: unknown, status: number, code: string): void {
  if (!(error instanceof ApiException)) throw error;
  if (error.getStatus() !== status) throw new Error(`Expected HTTP ${status}, got ${error.getStatus()}.`);
  const body = error.getResponse();
  if (typeof body !== 'object' || body === null || !('code' in body) || body.code !== code) {
    throw new Error(`Expected ${code}, got ${JSON.stringify(body)}.`);
  }
}

function shipmentRow() {
  return { id: SHIPMENT_ID, orderId: ORDER_ID, carrier: 'Test Carrier', trackingCode: 'TRACK-19', status: 'SHIPPED', shippedAt: now, deliveredAt: null, createdAt: now, updatedAt: now };
}

async function main(): Promise<void> {
  let orderStatus: any = 'PAID';
  let escrowStatus: any = 'HELD';
  let stored: any = null;
  let orderTransitions = 0;
  let escrowTransitions = 0;
  let creates = 0;

  const repository = {
    async findByOrderId() { return stored; },
    async createShipped() { creates += 1; stored = shipmentRow(); return stored; },
  };
  const orders = {
    async shippingContext() { return { id: ORDER_ID, buyerId: BUYER_ID, status: orderStatus, sellerIds: [SELLER_ID] }; },
    async markShippedFromShipment() { orderTransitions += 1; orderStatus = 'SHIPPED'; },
  };
  const escrow = {
    async shippingContext() { return { id: randomUUID(), orderId: ORDER_ID, status: escrowStatus }; },
    async markSellerShipped() { escrowTransitions += 1; escrowStatus = 'SELLER_SHIPPED'; },
  };
  const transactions = { async runSerializable<T>(work: (tx: any) => Promise<T>) { return work({ client: {} }); } };
  const service = new ShippingService(repository as never, new AuthorizationService(), transactions as never, orders as never, {record:async()=>{}} as never, escrow as never);

  const created = await service.createShipment(principal(SELLER_ID, 'SELLER'), ORDER_ID, { carrier: 'Test Carrier', trackingCode: 'TRACK-19' });
  if (created.status !== 'SHIPPED' || creates !== 1 || orderTransitions !== 1 || escrowTransitions !== 1) {
    throw new Error('Shipment creation did not perform exactly one coupled shipping transition.');
  }
  await service.createShipment(principal(SELLER_ID, 'SELLER'), ORDER_ID, { carrier: 'Test Carrier', trackingCode: 'TRACK-19' });
  if (creates !== 1 || orderTransitions !== 1 || escrowTransitions !== 1) throw new Error('Duplicate shipment request created duplicate writes.');
  let changedTrackingRejected = false;
  try {
    await service.createShipment(principal(SELLER_ID, 'SELLER'), ORDER_ID, { carrier: 'Test Carrier', trackingCode: 'DIFFERENT' });
  } catch (error) {
    assertApiError(error, 409, 'SHIPMENT_ALREADY_EXISTS');
    changedTrackingRejected = true;
  }
  if (!changedTrackingRejected || creates !== 1) throw new Error('Conflicting shipment replay was accepted.');


  await service.getShipment(principal(BUYER_ID, 'BUYER'), ORDER_ID);
  await service.getShipment(principal(SELLER_ID, 'SELLER'), ORDER_ID);

  let concealed = false;
  try { await service.getShipment(principal(OTHER_SELLER_ID, 'SELLER'), ORDER_ID); } catch (error) { assertApiError(error, 404, 'SHIPMENT_NOT_FOUND'); concealed = true; }
  if (!concealed) throw new Error('Non-participant seller could read shipment.');

  stored = null; orderStatus = 'PENDING_PAYMENT'; escrowStatus = 'HELD';
  let orderRejected = false;
  try { await service.createShipment(principal(SELLER_ID, 'SELLER'), ORDER_ID, { carrier: 'Test Carrier', trackingCode: 'X' }); } catch (error) { assertApiError(error, 409, 'INVALID_STATE_TRANSITION'); orderRejected = true; }
  if (!orderRejected) throw new Error('Ineligible order state was accepted for shipment.');

  stored = null; orderStatus = 'PAID'; escrowStatus = 'PENDING';
  let escrowRejected = false;
  try { await service.createShipment(principal(SELLER_ID, 'SELLER'), ORDER_ID, { carrier: 'Test Carrier', trackingCode: 'X' }); } catch (error) { assertApiError(error, 409, 'INVALID_STATE_TRANSITION'); escrowRejected = true; }
  if (!escrowRejected) throw new Error('Shipment was accepted without HELD escrow.');

  console.log('the implementation SHIPPING RUNTIME VERIFICATION PASSED');
}

await main();
