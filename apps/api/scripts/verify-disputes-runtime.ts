import 'dotenv/config';
import { randomUUID } from 'node:crypto';

process.env.DATABASE_URL ??= 'postgresql://tradenest:tradenest_local_only@127.0.0.1:5432/tradenest?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'dispute-runtime-jwt-secret-at-least-32-characters';

const { DisputesService } = await import('../src/modules/disputes/disputes.service.js');
const { AuthorizationService } = await import('../src/common/authorization/authorization.service.js');
const { ApiException } = await import('../src/common/http/api-exception.js');

const BUYER_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_BUYER_ID = '10000000-0000-4000-8000-000000000009';
const SELLER_ID = '10000000-0000-4000-8000-000000000002';
const ADMIN_ID = '10000000-0000-4000-8000-000000000003';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const DISPUTE_ID = '30000000-0000-4000-8000-000000000001';
const now = new Date('2026-10-05T18:00:00.000Z');

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

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: DISPUTE_ID,
    orderId: ORDER_ID,
    buyerId: BUYER_ID,
    sellerId: SELLER_ID,
    reason: 'Item issue',
    description: 'The delivered item does not match the order.',
    status: 'OPEN',
    resolution: null,
    resolvedBy: null,
    openedAt: now,
    resolvedAt: null,
    updatedAt: now,
    messages: [],
    evidence: [],
    ...overrides,
  };
}

async function main(): Promise<void> {
  let dispute: any = null;
  let orderStatus = 'PAID';
  let escrowStatus = 'HELD';
  let markOrderDisputed = 0;
  let markEscrowDisputed = 0;
  let underReview = 0;
  let release = 0;
  let refund = 0;
  let completed = 0;
  let refundedOrder = 0;
  let auditWrites = 0;
  let idempotencyComplete = 0;
  let replay: unknown = null;

  const repository = {
    async hasOpenForOrder() { return dispute?.status === 'OPEN'; },
    async findById() { return dispute; },
    async findByOrderId() { return dispute; },
    async lockById() { return Boolean(dispute); },
    async createOpen(input: any) { dispute = row({ ...input }); return dispute; },
    async addMessage(disputeId: string, authorId: string, body: string) {
      return { id: randomUUID(), disputeId, authorId, body, createdAt: now };
    },
    async addEvidence(disputeId: string, uploadedById: string, input: any) {
      return { id: randomUUID(), disputeId, uploadedById, ...input, fileName: input.fileName ?? null, mimeType: input.mimeType ?? null, createdAt: now };
    },
    async resolve(_id: string, resolution: string, resolvedBy: string, resolvedAt: Date) {
      if (!dispute || dispute.status !== 'OPEN') return false;
      dispute = row({ ...dispute, status: 'RESOLVED', resolution, resolvedBy, resolvedAt, updatedAt: resolvedAt });
      return true;
    },
  };
  const transactions = { async runSerializable<T>(work: (tx: any) => Promise<T>) { return work({ client: {} }); } };
  const idempotency = {
    prepare() { return { keyHash: 'k', requestHash: 'r' }; },
    async replayOrThrow() { return replay; },
    async claimOrReplay() { return null; },
    async complete() { idempotencyComplete += 1; },
  };
  const audit = { async write() { auditWrites += 1; } };
  const orders = {
    async disputeContext() { return { id: ORDER_ID, buyerId: BUYER_ID, status: orderStatus, sellerIds: [SELLER_ID] }; },
    async markDisputedFromDispute() { markOrderDisputed += 1; orderStatus = 'DISPUTED'; },
    async markCompletedFromEscrowRelease() { completed += 1; orderStatus = 'COMPLETED'; },
    async markRefundedFromEscrowRefund() { refundedOrder += 1; orderStatus = 'REFUNDED'; },
  };
  const escrow = {
    async shippingContext() { return { id: randomUUID(), orderId: ORDER_ID, status: escrowStatus }; },
    async markDisputed() { markEscrowDisputed += 1; escrowStatus = 'DISPUTED'; },
    async markUnderReview() { underReview += 1; escrowStatus = 'UNDER_REVIEW'; },
    async resolveDisputeRelease() { release += 1; escrowStatus = 'RELEASED'; },
    async resolveDisputeRefund() { refund += 1; /* escrow remains UNDER_REVIEW until provider acknowledgement */ },
  };

  const service = new DisputesService(
    repository as never,
    {
      async verify() { return { mimeType: 'image/jpeg', size: 512 }; },
      async signPrivateEvidence() { return 'https://storage.test/private?signature=test-only'; },
    } as never,
    new AuthorizationService(),
    transactions as never,
    idempotency as never,
    audit as never,
    orders as never,
    { record: async () => {} } as never,
    escrow as never,
  );

  const opened = await service.open(principal(BUYER_ID, 'BUYER'), ORDER_ID, {
    reason: 'Item issue',
    description: 'The delivered item does not match the order.',
  });
  if (opened.status !== 'OPEN' || orderStatus !== 'DISPUTED' || escrowStatus !== 'DISPUTED') {
    throw new Error('Opening a dispute did not atomically drive Dispute/Order/Escrow into disputed state.');
  }
  if (markOrderDisputed !== 1 || markEscrowDisputed !== 1) throw new Error('Dispute opening repeated coupled state writes.');

  let hidden = false;
  try { await service.get(principal(OTHER_BUYER_ID, 'BUYER'), DISPUTE_ID); }
  catch (error) { assertApiError(error, 404, 'DISPUTE_NOT_FOUND'); hidden = true; }
  if (!hidden) throw new Error('Non-participant could read the dispute.');

  const message = await service.addMessage(principal(SELLER_ID, 'SELLER'), DISPUTE_ID, { body: 'Seller response' });
  if (message.authorId !== SELLER_ID) throw new Error('Seller participant message was not attributed correctly.');
  const evidence = await service.addEvidence(principal(BUYER_ID, 'BUYER'), DISPUTE_ID, {
    objectKey: 'disputes/dispute/evidence.jpg',
    url: 'https://storage.example.invalid/disputes/dispute/evidence.jpg',
    fileName: 'evidence.jpg',
    mimeType: 'image/jpeg',
  });
  if (evidence.uploadedById !== BUYER_ID) throw new Error('Buyer evidence was not attributed correctly.');

  const released = await service.resolve(principal(ADMIN_ID, 'ADMIN'), DISPUTE_ID, { resolution: 'RELEASE_TO_SELLER' }, 'dispute-release-key', 'req-22-release');
  if (released.status !== 'RESOLVED' || released.resolution !== 'RELEASE_TO_SELLER') throw new Error('Release resolution did not resolve the dispute.');
  if (underReview !== 1 || release !== 1 || completed !== 1 || escrowStatus !== 'RELEASED' || orderStatus !== 'COMPLETED') {
    throw new Error('Seller-release resolution did not perform the required coupled state transitions.');
  }
  if (auditWrites !== 1 || idempotencyComplete !== 1) throw new Error('Dispute resolution did not write audit/idempotency completion exactly once.');

  // Refund outcome on a fresh dispute.
  dispute = row(); orderStatus = 'SHIPPED'; escrowStatus = 'DISPUTED'; underReview = 0; refund = 0; refundedOrder = 0; auditWrites = 0; idempotencyComplete = 0;
  const refunded = await service.resolve(principal(ADMIN_ID, 'ADMIN'), DISPUTE_ID, { resolution: 'REFUND_BUYER' }, 'dispute-refund-key', 'req-22-refund');
  if (refunded.status !== 'OPEN' || refunded.resolution !== null) throw new Error('Refund resolution must stay OPEN until provider confirms refund.');
  if (underReview !== 1 || refund !== 1 || refundedOrder !== 0 || escrowStatus !== 'UNDER_REVIEW' || orderStatus !== 'DISPUTED') {
    throw new Error('Buyer-refund resolution prematurely finalized financial state.');
  }

  replay = refunded;
  underReview = refund = refundedOrder = 0;
  const replayed = await service.resolve(principal(ADMIN_ID, 'ADMIN'), DISPUTE_ID, { resolution: 'REFUND_BUYER' }, 'dispute-refund-key', 'req-22-refund');
  if (replayed.status !== 'OPEN' || underReview || refund || refundedOrder) {
    throw new Error('Idempotency replay repeated dispute financial writes.');
  }

  await service.completeRefundAfterProvider(DISPUTE_ID, ADMIN_ID, {} as never);
  if (dispute.status !== 'RESOLVED' || dispute.resolution !== 'REFUND_BUYER') throw new Error('Verified refund did not finalize the dispute.');
  console.log('the implementation DISPUTES RUNTIME VERIFICATION PASSED');
}

await main();
