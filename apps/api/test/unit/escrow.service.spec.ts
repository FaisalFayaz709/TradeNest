import { jest } from '@jest/globals';
import { ApiException } from '../../src/common/http/api-exception.js';
import { EscrowService } from '../../src/modules/escrow/escrow.service.js';

const transaction = { client: {} } as never;

describe('EscrowService command transitions', () => {
  it('moves HELD escrow to SELLER_SHIPPED through the repository transition command', async () => {
    const repository = {
      transitionByOrder: jest.fn().mockResolvedValue(true),
      findByOrderId: jest.fn(),
    };
    const service = new EscrowService(repository as never, { write: jest.fn() } as never, {} as never);

    await service.markSellerShipped('20000000-0000-4000-8000-000000000001', transaction);

    expect(repository.transitionByOrder).toHaveBeenCalledWith(
      '20000000-0000-4000-8000-000000000001',
      ['HELD'],
      'SELLER_SHIPPED',
      transaction,
    );
  });

  it('treats a duplicate target state as idempotent', async () => {
    const repository = {
      transitionByOrder: jest.fn().mockResolvedValue(false),
      findByOrderId: jest.fn().mockResolvedValue({ status: 'SELLER_SHIPPED' }),
    };
    const service = new EscrowService(repository as never, { write: jest.fn() } as never, {} as never);

    await expect(service.markSellerShipped('20000000-0000-4000-8000-000000000001', transaction)).resolves.toBeUndefined();
  });

  it('rejects illegal escrow release states with INVALID_STATE_TRANSITION', async () => {
    const repository = {
      lockByOrderId: jest.fn().mockResolvedValue(undefined),
      findByOrderId: jest.fn().mockResolvedValue({
        id: '30000000-0000-4000-8000-000000000001',
        orderId: '20000000-0000-4000-8000-000000000001',
        paymentId: '40000000-0000-4000-8000-000000000001',
        status: 'HELD',
        amount: { toString: () => '19.95' },
      }),
    };
    const service = new EscrowService(repository as never, { write: jest.fn() } as never, {} as never);

    await expect(service.confirmBuyerAndRelease({
      orderId: '20000000-0000-4000-8000-000000000001',
      buyerId: '10000000-0000-4000-8000-000000000001',
      releasedAt: new Date('2026-10-06T00:00:00.000Z'),
      reference: 'test-confirmation',
    }, transaction)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_STATE_TRANSITION' }),
    } as Partial<ApiException>);
  });
});
