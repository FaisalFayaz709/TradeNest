import 'dotenv/config';
import { randomUUID } from 'node:crypto';

process.env.DATABASE_URL ??= 'postgresql://tradenest:tradenest_local_only@127.0.0.1:5432/tradenest?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'delivery-runtime-jwt-secret-at-least-32-characters';

const { OrdersService } = await import('../src/modules/orders/orders.service.js');
const { EscrowService } = await import('../src/modules/escrow/escrow.service.js');
const { AuthorizationService } = await import('../src/common/authorization/authorization.service.js');
const { ApiException } = await import('../src/common/http/api-exception.js');

const BUYER_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_BUYER_ID = '10000000-0000-4000-8000-000000000009';
const SELLER_ID = '10000000-0000-4000-8000-000000000002';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const ORDER_ITEM_ID = '21000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '22000000-0000-4000-8000-000000000001';
const ESCROW_ID = '30000000-0000-4000-8000-000000000001';
const PAYMENT_ID = '40000000-0000-4000-8000-000000000001';
const now = new Date('2026-10-05T12:00:00.000Z');
const money = (value: string) => ({ toString: () => value });

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

function orderRow(status: string) {
  return {
    id: ORDER_ID,
    orderNumber: 'TN-delivery',
    buyerId: BUYER_ID,
    status,
    currency: 'USD',
    subtotal: money('19.95'),
    shippingAmount: money('0.00'),
    discountAmount: money('0.00'),
    totalAmount: money('19.95'),
    shippingAddress: {
      sourceAddressId: '50000000-0000-4000-8000-000000000001',
      recipient: 'Buyer', line1: '1 Test', line2: null, city: 'Test', region: null,
      postalCode: null, country: 'US', phone: null,
    },
    paidAt: now,
    completedAt: status === 'COMPLETED' ? now : null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    items: [{
      id: ORDER_ITEM_ID,
      productId: PRODUCT_ID,
      sellerId: SELLER_ID,
      productName: 'Runtime Product',
      sku: 'delivery',
      quantity: 1,
      unitPrice: money('19.95'),
      totalPrice: money('19.95'),
      createdAt: now,
    }],
  };
}

async function main(): Promise<void> {
  let status = 'SHIPPED';
  let activeDispute = false;
  let escrowStatus = 'SELLER_SHIPPED';
  let deliveryWrites = 0;
  let shippingWrites = 0;
  let escrowReleaseWrites = 0;
  let completionWrites = 0;
  let idempotencyCompletions = 0;
  let replay: unknown = null;

  const repository = {
    async lockById() { return true; },
    async findOrderDetail() { return orderRow(status); },
    async markDeliveredFromBuyerConfirmation() {
      if (status !== 'SHIPPED') return false;
      deliveryWrites += 1;
      status = 'DELIVERED';
      return true;
    },
    async markCompletedFromEscrowRelease() {
      if (status !== 'DELIVERED') return false;
      completionWrites += 1;
      status = 'COMPLETED';
      return true;
    },
  };
  const transactions = { async runSerializable<T>(work: (tx: any) => Promise<T>) { return work({ client: {} }); } };
  const idempotency = {
    prepare() { return { keyHash: 'key', requestHash: 'request' }; },
    async replayOrThrow() { return replay; },
    async claimOrReplay() { return null; },
    async complete() { idempotencyCompletions += 1; },
  };
  const disputes = { async hasActiveDispute() { return activeDispute; } };
  const escrow = {
    async shippingContext() { return { id: ESCROW_ID, orderId: ORDER_ID, status: escrowStatus }; },
    async confirmBuyerAndRelease() { escrowReleaseWrites += 1; escrowStatus = 'RELEASED'; },
  };
  const shipping = { async markDeliveredFromBuyerConfirmation() { shippingWrites += 1; } };

  const service = new OrdersService(
    repository as never,
    new AuthorizationService(),
    transactions as never,
    idempotency as never,
    {} as never,
    {} as never,
    escrow as never,
    shipping as never,
    { record: async () => {} } as never,
    disputes as never,
  );

  const confirmed = await service.confirmDelivery(principal(BUYER_ID, 'BUYER'), ORDER_ID, 'confirm-delivery-delivery', 'req-delivery');
  if (confirmed.status !== 'COMPLETED') throw new Error(`Expected COMPLETED response, got ${confirmed.status}.`);
  if (deliveryWrites !== 1 || shippingWrites !== 1 || escrowReleaseWrites !== 1 || completionWrites !== 1 || idempotencyCompletions !== 1) {
    throw new Error('Buyer confirmation did not perform exactly one coupled delivery/release transition.');
  }

  status = 'SHIPPED'; activeDispute = true; escrowStatus = 'SELLER_SHIPPED';
  deliveryWrites = shippingWrites = escrowReleaseWrites = completionWrites = 0;
  let disputeBlocked = false;
  try {
    await service.confirmDelivery(principal(BUYER_ID, 'BUYER'), ORDER_ID, 'confirm-delivery-dispute');
  } catch (error) {
    assertApiError(error, 409, 'INVALID_STATE_TRANSITION');
    disputeBlocked = true;
  }
  if (!disputeBlocked) throw new Error('Active dispute did not block delivery confirmation.');
  if (deliveryWrites || shippingWrites || escrowReleaseWrites || completionWrites) throw new Error('Active dispute caused delivery/release writes.');

  activeDispute = false; status = 'PAID'; escrowStatus = 'SELLER_SHIPPED';
  let orderStateBlocked = false;
  try {
    await service.confirmDelivery(principal(BUYER_ID, 'BUYER'), ORDER_ID, 'confirm-delivery-unshipped');
  } catch (error) {
    assertApiError(error, 409, 'INVALID_STATE_TRANSITION');
    orderStateBlocked = true;
  }
  if (!orderStateBlocked) throw new Error('Unshipped order was accepted for delivery confirmation.');

  status = 'SHIPPED'; escrowStatus = 'HELD';
  let escrowStateBlocked = false;
  try {
    await service.confirmDelivery(principal(BUYER_ID, 'BUYER'), ORDER_ID, 'confirm-delivery-wrong-escrow');
  } catch (error) {
    assertApiError(error, 409, 'INVALID_STATE_TRANSITION');
    escrowStateBlocked = true;
  }
  if (!escrowStateBlocked) throw new Error('Delivery confirmation was accepted without SELLER_SHIPPED escrow.');

  status = 'SHIPPED'; escrowStatus = 'SELLER_SHIPPED';
  let ownershipHidden = false;
  try {
    await service.confirmDelivery(principal(OTHER_BUYER_ID, 'BUYER'), ORDER_ID, 'confirm-delivery-other-buyer');
  } catch (error) {
    assertApiError(error, 404, 'ORDER_NOT_FOUND');
    ownershipHidden = true;
  }
  if (!ownershipHidden) throw new Error('Another buyer could confirm delivery.');

  const replayOrder = {
    id: ORDER_ID,
    orderNumber: 'TN-delivery', buyerId: BUYER_ID, status: 'COMPLETED', currency: 'USD',
    subtotal: '19.95', shippingAmount: '0.00', discountAmount: '0.00', totalAmount: '19.95',
    shippingAddress: orderRow('COMPLETED').shippingAddress,
    paidAt: now.toISOString(), completedAt: now.toISOString(), cancelledAt: null,
    createdAt: now.toISOString(), updatedAt: now.toISOString(),
    items: [{ id: ORDER_ITEM_ID, productId: PRODUCT_ID, sellerId: SELLER_ID, productName: 'Runtime Product', sku: 'delivery', quantity: 1, unitPrice: '19.95', totalPrice: '19.95', createdAt: now.toISOString() }],
  };
  replay = replayOrder;
  deliveryWrites = shippingWrites = escrowReleaseWrites = completionWrites = 0;
  const replayed = await service.confirmDelivery(principal(BUYER_ID, 'BUYER'), ORDER_ID, 'confirm-delivery-replay');
  if (replayed.status !== 'COMPLETED') throw new Error('Idempotency replay did not return the original completed order.');
  if (deliveryWrites || shippingWrites || escrowReleaseWrites || completionWrites) throw new Error('Idempotency replay repeated delivery/release writes.');

  // Verify the EscrowModule's buyer-confirmation seam performs BUYER_CONFIRMED -> RELEASED, ledger-owned release and audit.
  let repoStatus = 'SELLER_SHIPPED';
  let releaseCalls = 0;
  let auditCalls = 0;
  const escrowRepository = {
    async lockByOrderId() {},
    async findByOrderId() {
      return { id: ESCROW_ID, orderId: ORDER_ID, paymentId: PAYMENT_ID, status: repoStatus, amount: money('19.95'), releasedAt: repoStatus === 'RELEASED' ? now : null };
    },
    async findById() {
      return { id: ESCROW_ID, orderId: ORDER_ID, paymentId: PAYMENT_ID, status: repoStatus, amount: money('19.95'), releasedAt: repoStatus === 'RELEASED' ? now : null };
    },
    async transitionByOrder(_orderId: string, from: string[], to: string) {
      if (!from.includes(repoStatus)) return false;
      repoStatus = to;
      return true;
    },
    async release() {
      if (repoStatus !== 'BUYER_CONFIRMED') return false;
      releaseCalls += 1;
      repoStatus = 'RELEASED';
      return true;
    },
  };
  const audit = { async write() { auditCalls += 1; } };
  const escrowService = new EscrowService(escrowRepository as never, audit as never, {} as never);
  await escrowService.confirmBuyerAndRelease({
    orderId: ORDER_ID,
    buyerId: BUYER_ID,
    releasedAt: now,
    reference: 'buyer-confirm-runtime',
    requestId: 'req-delivery',
  }, { client: {} } as never);
  if (repoStatus !== 'RELEASED' || releaseCalls !== 1 || auditCalls !== 1) {
    throw new Error('Escrow buyer confirmation did not create exactly one RELEASE transition/audit.');
  }

  console.log('the implementation DELIVERY CONFIRMATION RUNTIME VERIFICATION PASSED');
}

await main();
