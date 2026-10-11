import { jest } from '@jest/globals';
import { createHmac, randomUUID } from 'node:crypto';
import { AuthorizationService } from '../../src/common/authorization/authorization.service.js';
import { ApiException } from '../../src/common/http/api-exception.js';
import { RateLimitService } from '../../src/common/rate-limit/index.js';
import { PaymentsService } from '../../src/modules/payments/payments.service.js';
import { SandboxPaymentProvider } from '../../src/modules/payments/provider/sandbox-payment.provider.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://tradenest:tradenest@127.0.0.1:5432/tradenest_e2e?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test-jest-jwt-secret-at-least-32-characters';
process.env.CATALOG_DEFAULT_CURRENCY ??= 'USD';
process.env.PAYMENT_PROVIDER ??= 'sandbox';
process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET ??= 'test-jest-webhook-secret-at-least-32-characters';

const buyerId = '10000000-0000-4000-8000-000000000001';
const orderId = '20000000-0000-4000-8000-000000000001';
const paymentId = '30000000-0000-4000-8000-000000000001';
const occurredAt = new Date('2026-10-06T00:00:00.000Z');

function signedBody(payload: object) {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = createHmac('sha256', process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET!).update(rawBody).digest('hex');
  return { rawBody, headers: { 'x-tradenest-signature': `sha256=${signature}` } };
}

function fixture() {
  const provider = new SandboxPaymentProvider();
  let current: any = {
    id: paymentId,
    orderId,
    buyerId,
    provider: 'sandbox',
    providerPaymentId: `sandbox_${paymentId}`,
    status: 'PENDING',
    amount: { toString: () => '19.95' },
    currency: 'USD',
    failureCode: null,
    failureMessage: null,
    paidAt: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
  const writes = { payment: 0, order: 0, inventory: 0, escrow: 0, fraud: 0, failure: 0 };
  const repository = {
    findByProviderPaymentId: jest.fn().mockImplementation(async () => current),
    findById: jest.fn().mockImplementation(async () => current),
    markSucceeded: jest.fn().mockImplementation(async (_id: string, paidAt: Date) => {
      current = { ...current, status: 'SUCCEEDED', paidAt };
      writes.payment += 1;
    }),
    markFailed: jest.fn().mockImplementation(async () => {
      current = { ...current, status: 'FAILED' };
      writes.failure += 1;
    }),
  };
  const service = new PaymentsService(
    repository as never,
    new AuthorizationService(),
    { runSerializable: async (work: (tx: unknown) => Promise<unknown>) => work({ client: {} }) } as never,
    {} as never,
    new RateLimitService(),
    { byId: () => provider } as never,
    {
      paymentContext: async () => ({ id: orderId, buyerId, status: 'PENDING_PAYMENT', currency: 'USD', totalAmount: '19.95', paymentExpiresAt: null }),
      markPaidFromVerifiedPayment: async () => { writes.order += 1; },
      paymentInventoryCommitments: async () => [{ productId: randomUUID(), quantity: 1 }],
    } as never,
    { consumeInventoryReservation: async () => { writes.inventory += 1; } } as never,
    { holdVerifiedPayment: async () => { writes.escrow += 1; } } as never,
    { record: jest.fn().mockResolvedValue(undefined) } as never,
    { assessPaymentRisk: async () => { writes.fraud += 1; } } as never,
  );
  return { provider, service, writes, setCurrent: (next: any) => { current = next; }, getCurrent: () => current };
}

function successPayload(amount = '19.95') {
  return {
    eventId: randomUUID(),
    type: 'PAYMENT_SUCCEEDED',
    providerPaymentId: `sandbox_${paymentId}`,
    amount,
    currency: 'USD',
    occurredAt: occurredAt.toISOString(),
  };
}

describe('PaymentsService provider-verification regression suite', () => {
  it('rejects an invalid sandbox signature before financial writes', async () => {
    const { service, writes } = fixture();
    const rawBody = Buffer.from(JSON.stringify(successPayload()));
    await expect(service.handleWebhook('sandbox', rawBody, {
      'x-tradenest-signature': `sha256=${'0'.repeat(64)}`,
    })).rejects.toMatchObject({ status: 401, response: expect.objectContaining({ code: 'PAYMENT_WEBHOOK_SIGNATURE_INVALID' }) });
    expect(writes).toMatchObject({ payment: 0, order: 0, inventory: 0, escrow: 0 });
  });

  it('applies verified success once and makes duplicate success idempotent', async () => {
    const { service, writes } = fixture();
    const signed = signedBody(successPayload());

    const first = await service.handleWebhook('sandbox', signed.rawBody, signed.headers);
    const duplicate = await service.handleWebhook('sandbox', signed.rawBody, signed.headers);

    expect(first).toMatchObject({ status: 'SUCCEEDED', duplicate: false });
    expect(duplicate).toMatchObject({ status: 'SUCCEEDED', duplicate: true });
    expect(writes).toEqual({ payment: 1, order: 1, inventory: 1, escrow: 1, fraud: 1, failure: 0 });
  });

  it('rejects a provider amount mismatch without financial writes', async () => {
    const { service, writes } = fixture();
    const signed = signedBody(successPayload('20.95'));

    await expect(service.handleWebhook('sandbox', signed.rawBody, signed.headers)).rejects.toBeInstanceOf(ApiException);
    expect(writes).toMatchObject({ payment: 0, order: 0, inventory: 0, escrow: 0 });
  });

  it('uses the provider-neutral refund seam only for a succeeded authoritative payment', async () => {
    const { service, getCurrent, setCurrent } = fixture();
    setCurrent({ ...getCurrent(), status: 'SUCCEEDED', paidAt: occurredAt });

    const refund = await service.refundSucceededPayment({
      paymentId,
      amount: '19.95',
      idempotencyKey: 'test-refund-key',
    });

    expect(refund.provider).toBe('sandbox');
    expect(refund.providerRefundId).toContain('sandbox_refund_');
  });

  it('marks a failed provider event without mutating Order, Inventory, or Escrow', async () => {
    const { service, writes } = fixture();
    const signed = signedBody({
      ...successPayload(),
      eventId: randomUUID(),
      type: 'PAYMENT_FAILED',
      failureCode: 'DECLINED',
      failureMessage: 'Declined by sandbox',
    });

    const result = await service.handleWebhook('sandbox', signed.rawBody, signed.headers);
    expect(result).toMatchObject({ status: 'FAILED', duplicate: false });
    expect(writes.failure).toBe(1);
    expect(writes.order).toBe(0);
    expect(writes.inventory).toBe(0);
    expect(writes.escrow).toBe(0);
    expect(writes.fraud).toBe(1);
  });
});
