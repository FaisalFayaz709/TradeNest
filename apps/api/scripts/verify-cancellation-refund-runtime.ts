import 'dotenv/config';
import { randomUUID } from 'node:crypto';
process.env.DATABASE_URL ??= 'postgresql://tradenest:tradenest_local_only@127.0.0.1:5432/tradenest?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'cancel-runtime-jwt-secret-at-least-32-characters';

const { OrdersService } = await import('../src/modules/orders/orders.service.js');
const { AuthorizationService } = await import('../src/common/authorization/authorization.service.js');
const { ApiException } = await import('../src/common/http/api-exception.js');
const { assertOrderTransition } = await import('../src/modules/orders/order-state-machine.js');

const BUYER_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '30000000-0000-4000-8000-000000000001';
const SELLER_ID = '40000000-0000-4000-8000-000000000001';
const principal = { userId: BUYER_ID, sessionId: randomUUID(), email: 'buyer@example.invalid', name: 'Buyer', role: 'BUYER' as const };

function apiError(error: unknown, code: string): void {
  if (!(error instanceof ApiException)) throw error;
  const body = error.getResponse();
  if (error.getStatus() !== 409 || typeof body !== 'object' || body === null || !('code' in body) || body.code !== code) {
    throw new Error(`Expected 409 ${code}, got ${JSON.stringify(body)}`);
  }
}
function row(status: string) {
  const now = new Date('2026-10-05T12:00:00Z');
  return { id: ORDER_ID, orderNumber: 'TN-P21', buyerId: BUYER_ID, status, currency: 'USD', subtotal: {toString:()=> '10.00'}, shippingAmount:{toString:()=> '0.00'}, discountAmount:{toString:()=> '0.00'}, totalAmount:{toString:()=> '10.00'}, shippingAddress:{recipient:'Buyer'}, paidAt: status==='PAID'?now:null, completedAt:null, cancelledAt:null, createdAt:now, updatedAt:now, items:[{id:randomUUID(),productId:PRODUCT_ID,sellerId:SELLER_ID,productName:'P21',sku:'P21',quantity:2,unitPrice:{toString:()=> '5.00'},totalPrice:{toString:()=> '10.00'},createdAt:now}] } as any;
}

let current = row('PENDING_PAYMENT');
let releases = 0;
const repository = {
  async lockById(){ return true; },
  async findOrderDetail(){ return current; },
  async cancelPendingPaymentOrder(){ if(current.status!=='PENDING_PAYMENT') return false; current={...current,status:'CANCELLED',cancelledAt:new Date()}; return true; },
};
const transactions = { async runSerializable<T>(work:(tx:any)=>Promise<T>){ return work({client:{}}); } };
const idempotency = {};
const catalog = { async releaseInventoryReservation(_id:string,q:number){ releases += q; } };
const payments = { async orderCancellationContext(){ return {status:'PENDING',provider:'INTERNAL_PENDING',externalPending:false}; } };
const escrow = {}; const shipping = {}; const disputes = {};
const service = new OrdersService(repository as never,new AuthorizationService(),transactions as never,idempotency as never,catalog as never,payments as never,escrow as never,shipping as never,{record:async()=>{}} as never,disputes as never);

const cancelled = await service.cancel(principal as never, ORDER_ID);
if (cancelled.status !== 'CANCELLED' || releases !== 2) throw new Error('Pre-payment cancellation did not restore reserved inventory exactly once.');
await service.cancel(principal as never, ORDER_ID);
if (releases !== 2) throw new Error('Repeated cancellation restored inventory twice.');

current = row('PAID');
let rejected = false;
try { await service.cancel(principal as never, ORDER_ID); } catch (error) { apiError(error, 'INVALID_STATE_TRANSITION'); rejected = true; }
if (!rejected) throw new Error('PAID order was incorrectly cancellable.');

for (const state of ['PROCESSING','SHIPPED','DELIVERED','COMPLETED','DISPUTED','REFUNDED'] as const) {
  let invalid = false;
  try { assertOrderTransition(state, 'CANCELLED', ['PENDING_PAYMENT']); } catch (error) { apiError(error, 'INVALID_STATE_TRANSITION'); invalid = true; }
  if (!invalid) throw new Error(`${state} incorrectly allowed to transition to CANCELLED.`);
}
console.log('the implementation CANCELLATION/REFUND RUNTIME VERIFICATION PASSED');
