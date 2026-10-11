import 'dotenv/config';
import { randomUUID } from 'node:crypto';

process.env.DATABASE_URL ??= 'postgresql://tradenest:tradenest_local_only@127.0.0.1:5432/tradenest?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'escrow-runtime-jwt-secret-at-least-32-characters';
process.env.CATALOG_DEFAULT_CURRENCY ??= 'USD';
process.env.PAYMENT_PROVIDER ??= 'sandbox';
process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET ??= 'escrow-runtime-webhook-secret-at-least-32-characters';

const { EscrowCommandsService } = await import('../src/modules/escrow/escrow-commands.service.js');
const { AuthorizationService } = await import('../src/common/authorization/authorization.service.js');
const { ApiException } = await import('../src/common/http/api-exception.js');
const { SandboxPaymentProvider } = await import('../src/modules/payments/provider/sandbox-payment.provider.js');

const BUYER_ID = '10000000-0000-4000-8000-000000000001';
const SELLER_ID = '10000000-0000-4000-8000-000000000002';
const ADMIN_ID = '10000000-0000-4000-8000-000000000003';
const OUTSIDER_ID = '10000000-0000-4000-8000-000000000004';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const PAYMENT_ID = '30000000-0000-4000-8000-000000000001';
const ESCROW_ID = '40000000-0000-4000-8000-000000000001';

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

async function main(): Promise<void> {
  const provider = new SandboxPaymentProvider();
  const refundA = await provider.refundPayment({
    paymentId: PAYMENT_ID,
    providerPaymentId: `sandbox_${PAYMENT_ID}`,
    amount: '19.95',
    currency: 'USD',
    idempotencyKey: 'escrow-refund-key',
  });
  const refundB = await provider.refundPayment({
    paymentId: PAYMENT_ID,
    providerPaymentId: `sandbox_${PAYMENT_ID}`,
    amount: '19.95',
    currency: 'USD',
    idempotencyKey: 'escrow-refund-key',
  });
  if (refundA.providerRefundId !== refundB.providerRefundId) throw new Error('Provider refund is not idempotent for the same key.');

  let orderStatus: 'PAID' | 'PROCESSING' | 'DELIVERED' | 'DISPUTED' | 'COMPLETED' | 'REFUNDED' = 'DELIVERED';
  let row: any = {
    id: ESCROW_ID,
    orderId: ORDER_ID,
    paymentId: PAYMENT_ID,
    status: 'BUYER_CONFIRMED',
    amount: { toString: () => '19.95' },
    heldAt: new Date('2026-10-05T12:00:00.000Z'),
    releasedAt: null,
    refundedAt: null,
    transactions: [{ id: randomUUID(), type: 'HOLD', amount: { toString: () => '19.95' }, reference: 'hold', createdAt: new Date('2026-10-05T12:00:00.000Z') }],
  };
  let releaseWrites = 0;
  let refundWrites = 0;
  let refundIntents = 0;
  let orderCompleteWrites = 0;
  let orderRefundWrites = 0;
  let auditWrites = 0;
  let locks = 0;

  const repository = {
    async findByOrderId() { return row; },
    async findById() { return row; },
    async lockById() { locks += 1; },
    async release(_id: string, at: Date, reference: string) {
      if (!['BUYER_CONFIRMED', 'UNDER_REVIEW'].includes(row.status)) return false;
      row = { ...row, status: 'RELEASED', releasedAt: at, transactions: [...row.transactions, { id: randomUUID(), type: 'RELEASE', amount: row.amount, reference, createdAt: at }] };
      releaseWrites += 1;
      return true;
    },
    async refund(_id: string, at: Date, reference: string) {
      if (!['HELD', 'UNDER_REVIEW'].includes(row.status)) return false;
      row = { ...row, status: 'REFUNDED', refundedAt: at, transactions: [...row.transactions, { id: randomUUID(), type: 'REFUND', amount: row.amount, reference, createdAt: at }] };
      refundWrites += 1;
      return true;
    },
  };

  const idempotencyRows = new Map<string, { requestHash: string; response: unknown | null }>();
  const idempotency = {
    prepare(key: string, intent: unknown) { return { keyHash: key, requestHash: JSON.stringify(intent) }; },
    async replayOrThrow(_user: string, operation: string, token: any) {
      return idempotencyRows.get(`${operation}:${token.keyHash}`)?.response ?? null;
    },
    async claimOrReplay(_user: string, operation: string, token: any) {
      const k = `${operation}:${token.keyHash}`;
      const existing = idempotencyRows.get(k);
      if (existing) return existing.response;
      idempotencyRows.set(k, { requestHash: token.requestHash, response: null });
      return null;
    },
    async complete(_user: string, operation: string, token: any, response: unknown) {
      idempotencyRows.set(`${operation}:${token.keyHash}`, { requestHash: token.requestHash, response });
    },
  };
  const transactions = { async runSerializable<T>(work: (tx: any) => Promise<T>) { return work({ client: {} }); } };
  const orders = {
    async escrowAccessContext() { return { id: ORDER_ID, buyerId: BUYER_ID, sellerIds: [SELLER_ID], status: orderStatus }; },
    async markCompletedFromEscrowRelease() { orderStatus = 'COMPLETED'; orderCompleteWrites += 1; },
    async markRefundedFromEscrowRefund() { orderStatus = 'REFUNDED'; orderRefundWrites += 1; },
  };
  const payments = {
    async refundContext() { return { provider: 'sandbox', currency: 'USD' }; },
  };
  const audit = { async write() { auditWrites += 1; } };
  const refundOperations = { async enqueue() { refundIntents += 1; } };

  const service = new EscrowCommandsService(
    repository as never,
    new AuthorizationService(),
    transactions as never,
    idempotency as never,
    audit as never,
    orders as never,
    payments as never,
    refundOperations as never,
  );

  await service.getForOrder(principal(BUYER_ID, 'BUYER'), ORDER_ID);
  await service.getForOrder(principal(SELLER_ID, 'SELLER'), ORDER_ID);
  let concealed = false;
  try { await service.getForOrder(principal(OUTSIDER_ID, 'SELLER'), ORDER_ID); } catch (error) { assertApiError(error, 404, 'ESCROW_NOT_FOUND'); concealed = true; }
  if (!concealed) throw new Error('Non-participant seller could read escrow.');

  const released = await service.release(principal(ADMIN_ID, 'ADMIN'), ESCROW_ID, 'release-key-0001', 'req-release');
  if (released.status !== 'RELEASED' || releaseWrites !== 1 || orderCompleteWrites !== 1 || auditWrites !== 1 || locks !== 1) {
    throw new Error('Escrow release did not execute the required atomic release/order/audit path.');
  }
  await service.release(principal(ADMIN_ID, 'ADMIN'), ESCROW_ID, 'release-key-0001', 'req-release');
  if (releaseWrites !== 1 || orderCompleteWrites !== 1 || auditWrites !== 1) throw new Error('Duplicate release repeated financial writes.');

  row = {
    ...row,
    status: 'HELD',
    releasedAt: null,
    refundedAt: null,
    transactions: row.transactions.filter((entry: any) => entry.type === 'HOLD'),
  };
  orderStatus = 'PAID';
  const refunded = await service.refund(principal(ADMIN_ID, 'ADMIN'), ESCROW_ID, 'refund-key-0001', 'req-refund');
  if (refunded.status !== 'HELD' || refundIntents !== 1 || refundWrites !== 0 || orderRefundWrites !== 0 || auditWrites !== 1) {
    throw new Error('Escrow refund must queue exactly one durable obligation without settling before provider acknowledgement.');
  }
  await service.refund(principal(ADMIN_ID, 'ADMIN'), ESCROW_ID, 'refund-key-0001', 'req-refund');
  if (refundIntents !== 1 || refundWrites !== 0 || orderRefundWrites !== 0 || auditWrites !== 1) throw new Error('Duplicate refund added another obligation or settled early.');

  row = { ...row, status: 'SELLER_SHIPPED', refundedAt: null };
  orderStatus = 'PAID';
  let invalidRefund = false;
  try { await service.refund(principal(ADMIN_ID, 'ADMIN'), ESCROW_ID, 'refund-key-0002'); } catch (error) { assertApiError(error, 409, 'INVALID_STATE_TRANSITION'); invalidRefund = true; }
  if (!invalidRefund || refundIntents !== 1) throw new Error('Invalid escrow refund queued an obligation.');

  console.log('the implementation ESCROW RUNTIME VERIFICATION PASSED');
}

await main();
