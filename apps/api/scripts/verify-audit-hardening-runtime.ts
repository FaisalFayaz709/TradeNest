import assert from 'node:assert/strict';
import { AuditService } from '../src/common/audit/audit.service.js';
import { normalizeRequestId } from '../src/common/http/request-id.js';

async function main(): Promise<void> {
  assert.equal(normalizeRequestId('trace-audit'), 'trace-audit');
  assert.match(normalizeRequestId('x'.repeat(129)), /^[0-9a-f-]{36}$/);

  let persisted: any = null;
  const service = new AuditService({
    write: async (input: unknown) => { persisted = input; },
  } as never);
  await service.write({
    actorId: '10000000-0000-4000-8000-000000000001',
    action: 'DISPUTE_RESOLUTION',
    entityType: 'dispute',
    entityId: '20000000-0000-4000-8000-000000000001',
    before: { status: 'OPEN', refreshToken: 'must-not-persist' },
    after: { status: 'RESOLVED' },
    metadata: { outcome: 'REFUND_BUYER', authorization: 'must-not-persist' },
    requestId: 'r'.repeat(200),
  }, { client: {} } as never);

  assert.equal(persisted.before.refreshToken, '[REDACTED]');
  assert.equal(persisted.metadata.authorization, '[REDACTED]');
  assert.equal(persisted.requestId.length, 128);
  console.log('the implementation audit hardening runtime verification passed.');
}

void main();
