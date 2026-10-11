import { jest } from '@jest/globals';
import { AuthorizationService } from '../../src/common/authorization/authorization.service.js';
import { PaymentsService } from '../../src/modules/payments/payments.service.js';

const userId = '10000000-0000-4000-8000-000000000001';
const orderId = '20000000-0000-4000-8000-000000000001';
const paymentId = '30000000-0000-4000-8000-000000000001';
const key = 'test-payment-operation-idempotency-12r';
const principal = { userId, sessionId: 'session', email: 'buyer@example.org', name: 'Buyer', role: 'BUYER' as const };

function fixture() {
  const claims = new Map<string, { response: unknown | null; requestHash: string }>();
  const now = new Date();
  let payment = {
    id: paymentId, orderId, buyerId: userId,
    provider: 'INTERNAL_PENDING', providerPaymentId: `internal_pending_${paymentId}`,
    status: 'PENDING', amount: { toString: () => '19.95' }, currency: 'USD',
    failureCode: null, failureMessage: null, paidAt: null,
    createdAt: now, updatedAt: now,
  };
  let transactionDepth = 0;
  let calls = 0;
  let rejectNetwork = false;
  const transactions = {
    runSerializable: async (fn: (tx: unknown) => Promise<unknown>) => {
      transactionDepth++;
      try { return await fn({ client: {} }); } finally { transactionDepth--; }
    },
  };
  const provider = {
    id: 'sandbox',
    createPayment: jest.fn(async () => {
      expect(transactionDepth).toBe(0);
      expect(payment.providerPaymentId).toBe(`tradenest_init_${paymentId}`);
      calls++;
      if (rejectNetwork) throw new Error('provider unavailable after claim committed');
      return { provider: 'sandbox', providerPaymentId: `sandbox_${paymentId}` };
    }),
  };
  const idempotency = {
    prepare: (rawKey: string, request: { orderId: string }) => ({ keyHash: rawKey, requestHash: request.orderId }),
    replayOrThrow: async (_uid: string, op: string, token: { keyHash: string }) => claims.get(`${op}:${token.keyHash}`)?.response ?? null,
    replayOrPermitInProgress: async (_uid: string, op: string, token: { keyHash: string }) => claims.get(`${op}:${token.keyHash}`)?.response ?? null,
    claimOrResume: async (_uid: string, op: string, token: { keyHash: string; requestHash: string }) => {
      const name = `${op}:${token.keyHash}`;
      if (!claims.has(name)) claims.set(name, { response: null, requestHash: token.requestHash });
      return claims.get(name)!.response;
    },
    hasCompetingUnfinishedClaim: async (_uid: string, op: string, token: { keyHash: string; requestHash: string }) =>
      [...claims.entries()].some(([k, v]) => k.startsWith(`${op}:`) && k !== `${op}:${token.keyHash}` &&
        v.requestHash === token.requestHash && v.response === null),
    complete: async (_uid: string, op: string, token: { keyHash: string }, response: unknown) => {
      claims.get(`${op}:${token.keyHash}`)!.response = response;
    },
  };
  const repo = {
    findLatestForOrder: jest.fn(async () => payment),
    findById: jest.fn(async () => payment),
    initializePendingPayment: jest.fn(async (_id: string, id: string, providerPaymentId: string) => {
      payment = { ...payment, provider: id, providerPaymentId, updatedAt: new Date() };
      return payment;
    }),
  };
  const service = new PaymentsService(
    repo as never, new AuthorizationService(), transactions as never,
    idempotency as never, {} as never,
    { configured: () => provider } as never,
    { paymentContext: async () => ({ id: orderId, buyerId: userId, status: 'PENDING_PAYMENT', currency: 'USD', totalAmount: '19.95', paymentExpiresAt: null }) } as never,
    {} as never, {} as never, {} as never, {} as never,
  );
  return { service, provider, getPayment: () => payment, getCalls: () => calls,
    makeProviderFail: (v: boolean) => { rejectNetwork = v; }, getTransactionDepth: () => transactionDepth };
}

describe('Payment compliance durable payment initiation', () => {
  it('commits claim before provider IO and binds provider ID only in a separate transaction', async () => {
    const { service, getPayment, getCalls, getTransactionDepth } = fixture();
    const result = await service.initiate(principal, orderId, key);
    expect(result.payment.providerPaymentId).toBe(`sandbox_${paymentId}`);
    expect(getPayment().providerPaymentId).toBe(`sandbox_${paymentId}`);
    expect(getCalls()).toBe(1);
    expect(getTransactionDepth()).toBe(0);
    await service.initiate(principal, orderId, key);
    expect(getCalls()).toBe(1);
  });
  it('resumes an ambiguous provider result with exactly the original key', async () => {
    const f = fixture(); f.makeProviderFail(true);
    await expect(f.service.initiate(principal, orderId, key)).rejects.toThrow('provider unavailable');
    expect(f.getPayment().providerPaymentId).toBe(`tradenest_init_${paymentId}`);
    f.makeProviderFail(false);
    const result = await f.service.initiate(principal, orderId, key);
    expect(result.payment.providerPaymentId).toBe(`sandbox_${paymentId}`);
    expect(f.getCalls()).toBe(2);
  });
  it('rejects a different key while the original provider attempt is unresolved', async () => {
    const f = fixture(); f.makeProviderFail(true);
    await expect(f.service.initiate(principal, orderId, key)).rejects.toThrow();
    f.makeProviderFail(false);
    await expect(f.service.initiate(principal, orderId, 'different-header-key-that-is-valid')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PAYMENT_INITIATION_IN_PROGRESS' }),
    });
    expect(f.getCalls()).toBe(1);
  });
});
