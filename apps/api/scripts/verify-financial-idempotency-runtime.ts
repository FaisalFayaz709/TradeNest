import { FinancialIdempotencyService } from '../src/common/idempotency/idempotency.service.js';
import { ApiException } from '../src/common/http/api-exception.js';

type Stored = { requestHash: string | null; response: unknown | null };

class FakeRepository {
  rows = new Map<string, Stored>();
  hashKey(key: string): string {
    return `key:${key}`;
  }
  async findRecord(userId: string, operation: string, keyHash: string): Promise<Stored | null> {
    return this.rows.get(`${userId}|${operation}|${keyHash}`) ?? null;
  }
  async createClaim(userId: string, operation: string, keyHash: string, requestHash: string): Promise<void> {
    const key = `${userId}|${operation}|${keyHash}`;
    if (this.rows.has(key)) {
      const error = new Error('unique') as Error & { code?: string };
      error.code = 'P2002';
      throw error;
    }
    this.rows.set(key, { requestHash, response: null });
  }
  async completeClaim(userId: string, operation: string, keyHash: string, response: unknown): Promise<void> {
    const key = `${userId}|${operation}|${keyHash}`;
    const row = this.rows.get(key);
    if (!row) throw new Error('claim missing');
    this.rows.set(key, { ...row, response });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const repo = new FakeRepository();
  const service = new FinancialIdempotencyService(repo as never);
  const userId = '00000000-0000-4000-8000-000000000001';
  const operation = 'CHECKOUT_CREATE';

  const a = service.prepare('retry-key-0001', { shippingAddressId: 'A', nested: { z: 1, a: 2 } });
  const b = service.prepare('retry-key-0001', { nested: { a: 2, z: 1 }, shippingAddressId: 'A' });
  assert(a.requestHash === b.requestHash, 'Canonical request hashing must be key-order independent.');

  const tx = {} as never;
  const first = await service.claimOrReplay(userId, operation, a, tx);
  assert(first === null, 'First use must claim rather than replay.');
  await service.complete(userId, operation, a, { orderId: 'order-1' }, tx);

  const replay = await service.replayOrThrow<{ orderId: string }>(userId, operation, a);
  assert(replay?.orderId === 'order-1', 'Same request/key must replay the original response.');

  const different = service.prepare('retry-key-0001', { shippingAddressId: 'B' });
  let conflict = false;
  try {
    await service.replayOrThrow(userId, operation, different);
  } catch (error) {
    conflict = error instanceof ApiException && error.getStatus() === 409 && (error.getResponse() as { code?: string }).code === 'IDEMPOTENCY_KEY_REUSED';
  }
  assert(conflict, 'Same key with a different request must return IDEMPOTENCY_KEY_REUSED.');

  repo.rows.set(`${userId}|LEGACY|key:legacy-key`, { requestHash: null, response: { ok: true } });
  const legacy = service.prepare('legacy-key', { any: 'new-fingerprint-ignored-for-legacy-only' });
  const legacyReplay = await service.replayOrThrow<{ ok: boolean }>(userId, 'LEGACY', legacy);
  assert(legacyReplay?.ok === true, 'Legacy NULL-fingerprint records must remain replayable.');

  console.log('the implementation FINANCIAL IDEMPOTENCY RUNTIME VERIFICATION PASSED');
}

await main();
