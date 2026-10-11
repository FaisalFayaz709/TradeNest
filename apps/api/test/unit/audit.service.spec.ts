import { jest } from '@jest/globals';
import { AuditService } from '../../src/common/audit/audit.service.js';

const transaction = { client: {} } as never;

describe('AuditService hardening', () => {
  it('redacts credential-like fields recursively and caps request IDs to database width', async () => {
    const repository = { write: jest.fn().mockResolvedValue(undefined) };
    const service = new AuditService(repository as never);

    await service.write({
      actorId: '10000000-0000-4000-8000-000000000001',
      action: 'ESCROW_REFUND',
      entityType: 'escrow',
      entityId: '20000000-0000-4000-8000-000000000001',
      before: { status: 'HELD', nested: { accessToken: 'secret-token' } },
      after: { status: 'REFUNDED' },
      metadata: { authorization: 'Bearer secret', providerRefundId: 'refund-safe-reference' },
      requestId: ` audit-${'x'.repeat(200)} `,
    }, transaction);

    expect(repository.write).toHaveBeenCalledWith(expect.objectContaining({
      before: { status: 'HELD', nested: { accessToken: '[REDACTED]' } },
      after: { status: 'REFUNDED' },
      metadata: { authorization: '[REDACTED]', providerRefundId: 'refund-safe-reference' },
      requestId: expect.any(String),
    }), transaction);
    expect(repository.write.mock.calls[0][0].requestId).toHaveLength(128);
  });

  it('rejects malformed action and entity vocabulary before persistence', async () => {
    const repository = { write: jest.fn() };
    const service = new AuditService(repository as never);

    await expect(service.write({ action: 'bad action', entityType: 'escrow' }, transaction)).rejects.toThrow('Invalid audit action');
    await expect(service.write({ action: 'ESCROW_RELEASE', entityType: 'Bad Entity' }, transaction)).rejects.toThrow('Invalid audit entity type');
    expect(repository.write).not.toHaveBeenCalled();
  });
});
