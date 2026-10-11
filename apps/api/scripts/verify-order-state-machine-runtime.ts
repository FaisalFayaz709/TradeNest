import 'dotenv/config';
import { randomUUID } from 'node:crypto';

process.env.DATABASE_URL ??= 'postgresql://tradenest:tradenest_local_only@127.0.0.1:5432/tradenest?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'orderstate-runtime-jwt-secret-at-least-32-characters';

const { OrdersService } = await import('../src/modules/orders/orders.service.js');
const { AuthorizationService } = await import('../src/common/authorization/authorization.service.js');
const { ApiException } = await import('../src/common/http/api-exception.js');
const { assertOrderTransition } = await import('../src/modules/orders/order-state-machine.js');

const BUYER_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_BUYER_ID = '10000000-0000-4000-8000-000000000002';
const SELLER_ID = '10000000-0000-4000-8000-000000000003';
const OTHER_SELLER_ID = '10000000-0000-4000-8000-000000000004';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '30000000-0000-4000-8000-000000000001';

const principal = (userId: string, role: 'BUYER' | 'SELLER' | 'ADMIN') => ({
  userId,
  sessionId: randomUUID(),
  email: `${role.toLowerCase()}@example.invalid`,
  name: role,
  role,
});

function assertApiError(error: unknown, status: number, code: string): void {
  if (!(error instanceof ApiException)) throw error;
  if (error.getStatus() !== status) throw new Error(`Expected HTTP ${status}, got ${error.getStatus()}.`);
  const body = error.getResponse();
  if (typeof body !== 'object' || body === null || !('code' in body) || body.code !== code) {
    throw new Error(`Expected ${code}, got ${JSON.stringify(body)}.`);
  }
}

function row(status: string = 'PENDING_PAYMENT') {
  const now = new Date('2026-10-05T12:00:00.000Z');
  return {
    id: ORDER_ID,
    orderNumber: 'TN-orderstate',
    buyerId: BUYER_ID,
    status,
    currency: 'USD',
    subtotal: { toString: () => '19.95' },
    shippingAmount: { toString: () => '0.00' },
    discountAmount: { toString: () => '0.00' },
    totalAmount: { toString: () => '19.95' },
    shippingAddress: {
      sourceAddressId: '40000000-0000-4000-8000-000000000001',
      recipient: 'Buyer', line1: '1 Test St', line2: null, city: 'Test', region: null,
      postalCode: null, country: 'US', phone: null,
    },
    paidAt: null,
    completedAt: null,
    cancelledAt: status === 'CANCELLED' ? now : null,
    createdAt: now,
    updatedAt: now,
    items: [{
      id: '50000000-0000-4000-8000-000000000001',
      productId: PRODUCT_ID,
      sellerId: SELLER_ID,
      productName: 'Runtime Product',
      sku: 'orderstate-SKU',
      quantity: 1,
      unitPrice: { toString: () => '19.95' },
      totalPrice: { toString: () => '19.95' },
      createdAt: now,
    }],
  } as any;
}

async function main(): Promise<void> {
  let current = row();
  let releases = 0;
  let cancelWrites = 0;
  let locks = 0;
  let externalPending = false;

  const repository = {
    async listBuyerOrders() { return { rows: [current], total: 1 }; },
    async findOrderDetail(id: string) { return id === ORDER_ID ? current : null; },
    async lockById(id: string) { if (id !== ORDER_ID) return false; locks += 1; return true; },
    async cancelPendingPaymentOrder() {
      if (current.status !== 'PENDING_PAYMENT') return false;
      current = { ...current, status: 'CANCELLED', cancelledAt: new Date('2026-10-05T12:05:00.000Z') };
      cancelWrites += 1;
      return true;
    },
  };
  const transactions = { async runSerializable<T>(work: (tx: any) => Promise<T>) { return work({ client: {} }); } };
  const catalog = { async releaseInventoryReservation() { releases += 1; } };
  const payments = {
    async orderCancellationContext() {
      return externalPending
        ? { status: 'PENDING', provider: 'sandbox', externalPending: true }
        : { status: 'PENDING', provider: 'INTERNAL_PENDING', externalPending: false };
    },
  };

  const service = new OrdersService(
    repository as never,
    new AuthorizationService(),
    transactions as never,
    {prepare:()=>({}),replayOrThrow:async()=>null} as never,
    catalog as never,
    payments as never,
    {} as never,
    {} as never,
    {record:async()=>{}} as never,
    {} as never,
  );

  const cancelled = await service.cancel(principal(BUYER_ID, 'BUYER'), ORDER_ID);
  if (cancelled.status !== 'CANCELLED' || releases !== 1 || cancelWrites !== 1 || locks !== 1) {
    throw new Error('Eligible cancellation did not cancel once and restore reservation exactly once.');
  }
  await service.cancel(principal(BUYER_ID, 'BUYER'), ORDER_ID);
  if (releases !== 1 || cancelWrites !== 1) throw new Error('Duplicate cancellation released inventory twice.');

  current = row('PAID');
  let paidRejected = false;
  try { await service.cancel(principal(BUYER_ID, 'BUYER'), ORDER_ID); } catch (error) { assertApiError(error, 409, 'INVALID_STATE_TRANSITION'); paidRejected = true; }
  if (!paidRejected) throw new Error('Paid order cancellation was not rejected.');

  current = row();
  externalPending = true;
  let providerPendingRejected = false;
  try { await service.cancel(principal(BUYER_ID, 'BUYER'), ORDER_ID); } catch (error) { assertApiError(error, 409, 'INVALID_STATE_TRANSITION'); providerPendingRejected = true; }
  if (!providerPendingRejected || releases !== 1) throw new Error('Provider-initialized pending payment cancellation was not blocked before inventory release.');

  current = row();
  externalPending = false;
  let concealed = false;
  try { await service.getOrder(principal(OTHER_SELLER_ID, 'SELLER'), ORDER_ID); } catch (error) { assertApiError(error, 404, 'ORDER_NOT_FOUND'); concealed = true; }
  if (!concealed) throw new Error('Non-participant seller could read order detail.');
  await service.getOrder(principal(SELLER_ID, 'SELLER'), ORDER_ID);

  let directInvalid = false;
  try { assertOrderTransition('PAID', 'CANCELLED', ['PENDING_PAYMENT']); } catch (error) { assertApiError(error, 409, 'INVALID_STATE_TRANSITION'); directInvalid = true; }
  if (!directInvalid) throw new Error('Order state-machine guard accepted an invalid transition.');

  let otherBuyerConcealed = false;
  try { await service.cancel(principal(OTHER_BUYER_ID, 'BUYER'), ORDER_ID); } catch (error) { assertApiError(error, 404, 'ORDER_NOT_FOUND'); otherBuyerConcealed = true; }
  if (!otherBuyerConcealed) throw new Error('Non-owning buyer could cancel order.');

  console.log('the implementation ORDER STATE-MACHINE RUNTIME VERIFICATION PASSED');
}

await main();
