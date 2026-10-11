import { jest } from '@jest/globals';
import { UsersRepository } from '../../src/modules/users/users.repository.js';

describe('UsersRepository ownership-scoped persistence', () => {
  it('scopes wishlist reads to the caller-owned user id', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new UsersRepository({ wishlistItem: { findMany } } as never);

    await repository.listWishlist('10000000-0000-4000-8000-000000000001');

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: '10000000-0000-4000-8000-000000000001' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });

  it('scopes wishlist deletion by both user and product', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const repository = new UsersRepository({ wishlistItem: { deleteMany } } as never);

    await expect(repository.deleteWishlistItem(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
    )).resolves.toBe(true);

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        userId: '10000000-0000-4000-8000-000000000001',
        productId: '20000000-0000-4000-8000-000000000001',
      },
    });
  });
});
