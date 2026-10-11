import 'dotenv/config';
import { createHmac, randomUUID } from 'node:crypto';

process.env.DATABASE_URL ??= 'postgresql://tradenest:tradenest_local_only@127.0.0.1:5432/tradenest?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'payment-runtime-jwt-secret-at-least-32-characters';
process.env.CATALOG_DEFAULT_CURRENCY ??= 'USD';
process.env.PAYMENT_PROVIDER ??= 'sandbox';
process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET ??= 'payment-runtime-webhook-secret-at-least-32-characters';

const { AuthorizationService } = await import('../src/common/authorization/authorization.service.js');
const { ApiException } = await import('../src/common/http/api-exception.js');
const { RateLimitService } = await import('../src/common/rate-limit/index.js');
const { PaymentsService } = await import('../src/modules/payments/payments.service.js');
const { SandboxPaymentProvider } = await import('../src/modules/payments/provider/sandbox-payment.provider.js');

const BUYER_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const PAYMENT_ID = '30000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-10-05T12:00:00.000Z');

const principal = {
  userId: BUYER_ID,
  sessionId: '40000000-0000-4000-8000-000000000001',
  email: 'buyer@example.invalid',
  name: 'Payment Buyer',
  role: 'BUYER' as const,
};

function assertApiError(error: unknown, status: number, code: string): void {
  if (!(error instanceof ApiException)) throw error;
  if (error.getStatus() !== status) throw new Error(`Expected HTTP ${status}, got ${error.getStatus()}.`);
  const body = error.getResponse();
  if (typeof body !== 'object' || body === null || !('code' in body) || body.code !== code) {
    throw new Error(`Expected ${code}, got ${JSON.stringify(body)}.`);
  }
}

function signedBody(payload: object) {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = createHmac('sha256', process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET!).update(rawBody).digest('hex');
  return { rawBody, headers: { 'x-tradenest-signature': `sha256=${signature}` } };
}

async function main(): Promise<void> {
  const provider = new SandboxPaymentProvider();
  const successPayload = {
    eventId: randomUUID(),
    type: 'PAYMENT_SUCCEEDED',
    providerPaymentId: `sandbox_${PAYMENT_ID}`,
    amount: '19.95',
    currency: 'USD',
    occurredAt: NOW.toISOString(),
  };
  const signed = signedBody(successPayload);
  const verified = provider.verifyWebhook(signed);
  if (verified.type !== 'PAYMENT_SUCCEEDED' || verified.amount !== '19.95') throw new Error('Sandbox webhook verification failed.');

  let invalidRejected = false;
  try {
    provider.verifyWebhook({ rawBody: signed.rawBody, headers: { 'x-tradenest-signature': 'sha256=' + '0'.repeat(64) } });
  } catch (error) {
    assertApiError(error, 401, 'PAYMENT_WEBHOOK_SIGNATURE_INVALID');
    invalidRejected = true;
  }
  if (!invalidRejected) throw new Error('Invalid webhook signature was accepted.');

  let current: any = {
    id: PAYMENT_ID,
    orderId: ORDER_ID,
    buyerId: BUYER_ID,
    provider: 'sandbox',
    providerPaymentId: `sandbox_${PAYMENT_ID}`,
    status: 'PENDING' as 'PENDING' | 'SUCCEEDED' | 'FAILED',
    amount: { toString: () => '19.95' },
    currency: 'USD',
    failureCode: null,
    failureMessage: null,
    paidAt: null as Date | null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  let succeededWrites = 0;
  let failedWrites = 0;
  let orderPaidWrites = 0;
  let escrowHoldWrites = 0;
  let idempotencyStores = 0;

  const repository = {
    async createPendingCheckoutPayment() { throw new Error('unused'); },
    async findByProviderPaymentId() { return current; },
    async findById() { return current; },
    async findLatestForOrder() { return current; },
    async initializePendingPayment() { return current; },
    async createProviderPendingPayment() { return current; },
    async markSucceeded(_id: string, paidAt: Date) { current = { ...current, status: 'SUCCEEDED', paidAt }; succeededWrites += 1; },
    async markFailed(_id: string, code: string | null, message: string | null) { current = { ...current, status: 'FAILED', failureCode: code, failureMessage: message }; failedWrites += 1; },
  };
  const transactions = { async runSerializable<T>(work: (tx: unknown) => Promise<T>) { return work({ client: {} }); } };
  const idempotencyMemory = new Map<string, unknown>();
  const idempotency = {
    hashKey(value: string) { return `hash:${value}`; },
    async findResponse(_userId: string, operation: string, key: string) { return idempotencyMemory.get(`${operation}:${key}`) ?? null; },
    async storeResponse(_userId: string, operation: string, key: string, response: unknown) { idempotencyStores += 1; idempotencyMemory.set(`${operation}:${key}`, response); },
  };
  const orders = {
    async paymentContext() { return { id: ORDER_ID, buyerId: BUYER_ID, status: 'PENDING_PAYMENT', currency: 'USD', totalAmount: '19.95', paymentExpiresAt: null }; },
    async markPaidFromVerifiedPayment() { orderPaidWrites += 1; },
  };
  const escrow = { async holdVerifiedPayment() { escrowHoldWrites += 1; return { id: randomUUID(), orderId: ORDER_ID, paymentId: PAYMENT_ID, status: 'HELD', amount: '19.95' }; } };
  const providers = { configured: () => provider, byId: () => provider };

  const service = new PaymentsService(
    repository as never,
    new AuthorizationService(),
    transactions as never,
    idempotency as never,
    new RateLimitService(),
    providers as never,
    orders as never,
    { async consumeInventoryReservation() {} } as never,
    escrow as never,
    { record: async () => {} } as never,
    { async assessPaymentRisk() {} } as never,
  );

  const ack = await service.handleWebhook('sandbox', signed.rawBody, signed.headers);
  if (ack.status !== 'SUCCEEDED' || ack.duplicate) throw new Error(`Unexpected success acknowledgement: ${JSON.stringify(ack)}`);
  if (succeededWrites !== 1 || orderPaidWrites !== 1 || escrowHoldWrites !== 1) {
    throw new Error(`Payment success did not execute exactly one atomic-write path: payment=${succeededWrites}, order=${orderPaidWrites}, escrow=${escrowHoldWrites}.`);
  }

  const duplicate = await service.handleWebhook('sandbox', signed.rawBody, signed.headers);
  if (!duplicate.duplicate || duplicate.status !== 'SUCCEEDED') throw new Error('Duplicate success webhook was not idempotent.');
  if (succeededWrites !== 1 || orderPaidWrites !== 1 || escrowHoldWrites !== 1) throw new Error('Duplicate success webhook repeated financial writes.');

  current = { ...current, status: 'PENDING', paidAt: null };
  const mismatch = signedBody({ ...successPayload, eventId: randomUUID(), amount: '20.95' });
  let mismatchRejected = false;
  try {
    await service.handleWebhook('sandbox', mismatch.rawBody, mismatch.headers);
  } catch (error) {
    assertApiError(error, 409, 'PAYMENT_WEBHOOK_AMOUNT_MISMATCH');
    mismatchRejected = true;
  }
  if (!mismatchRejected) throw new Error('Mismatched provider amount was accepted.');
  if (succeededWrites !== 1 || orderPaidWrites !== 1 || escrowHoldWrites !== 1) throw new Error('Amount mismatch caused financial writes.');

  const failedPayload = signedBody({
    eventId: randomUUID(),
    type: 'PAYMENT_FAILED',
    providerPaymentId: `sandbox_${PAYMENT_ID}`,
    amount: '19.95',
    currency: 'USD',
    occurredAt: NOW.toISOString(),
    failureCode: 'DECLINED',
    failureMessage: 'Sandbox decline',
  });
  const failed = await service.handleWebhook('sandbox', failedPayload.rawBody, failedPayload.headers);
  if (failed.status !== 'FAILED' || failedWrites !== 1) throw new Error('Failed payment event did not mark Payment FAILED.');
  if (orderPaidWrites !== 1 || escrowHoldWrites !== 1) throw new Error('Failed payment event mutated Order/Escrow.');

  current = { ...current, status: 'PENDING', failureCode: null, failureMessage: null };
  const initiated = await service.initiate(principal, ORDER_ID, 'payment-payment-key');
  const replay = await service.initiate(principal, ORDER_ID, 'payment-payment-key');
  if (initiated.payment.id !== replay.payment.id || idempotencyStores !== 1) throw new Error('Payment creation idempotency failed.');

  console.log('the implementation PAYMENT RUNTIME VERIFICATION PASSED');
}

void main();
