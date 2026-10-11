import 'dotenv/config';
import { randomUUID } from 'node:crypto';

process.env.DATABASE_URL ??= 'postgresql://tradenest:tradenest_local_only@127.0.0.1:5432/tradenest?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'wishlist-runtime-jwt-secret-at-least-32-characters';

const { WishlistService } = await import('../src/modules/users/wishlist.service.js');
const { AuthorizationService } = await import('../src/common/authorization/authorization.service.js');
const { ApiException } = await import('../src/common/http/api-exception.js');

const BUYER_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_BUYER_ID = '10000000-0000-4000-8000-000000000009';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
const WISHLIST_ID = '50000000-0000-4000-8000-000000000001';
const now = new Date('2026-10-05T21:00:00.000Z');

const principal = (userId: string) => ({
  userId,
  sessionId: randomUUID(),
  email: 'buyer@example.invalid',
  name: 'Buyer',
  role: 'BUYER' as const,
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
  const rows: any[] = [];
  let catalogChecks = 0;
  const repository = {
    async listWishlist(userId: string) { return rows.filter((row) => row.userId === userId); },
    async findWishlistItem(userId: string, productId: string) { return rows.find((row) => row.userId === userId && row.productId === productId) ?? null; },
    async createWishlistItem(userId: string, productId: string) {
      const row = { id: WISHLIST_ID, userId, productId, createdAt: now };
      rows.push(row); return row;
    },
    async deleteWishlistItem(userId: string, productId: string) {
      const index = rows.findIndex((row) => row.userId === userId && row.productId === productId);
      if (index < 0) return false;
      rows.splice(index, 1); return true;
    },
  };
  const catalog = { async requireWishlistEligibleProduct(productId: string) { if (productId !== PRODUCT_ID) throw new Error('Unexpected product.'); catalogChecks += 1; } };
  const service = new WishlistService(repository as never, new AuthorizationService(), catalog as never);

  const created = await service.add(principal(BUYER_ID), PRODUCT_ID);
  if (created.productId !== PRODUCT_ID || 'price' in created || 'availableQuantity' in created) throw new Error('Wishlist response leaked product authority.');
  const repeated = await service.add(principal(BUYER_ID), PRODUCT_ID);
  if (repeated.id !== created.id || rows.length !== 1) throw new Error('Repeated add created a duplicate wishlist relation.');
  if (catalogChecks !== 2) throw new Error('Catalog eligibility must be checked on every add request.');

  rows.push({ id: randomUUID(), userId: OTHER_BUYER_ID, productId: randomUUID(), createdAt: now });
  const own = await service.list(principal(BUYER_ID));
  if (own.length !== 1 || own[0]?.id !== WISHLIST_ID) throw new Error('Wishlist listing crossed Buyer ownership boundary.');

  let concealed = false;
  try { await service.remove(principal(OTHER_BUYER_ID), PRODUCT_ID); } catch (error) { assertApiError(error, 404, 'WISHLIST_ITEM_NOT_FOUND'); concealed = true; }
  if (!concealed) throw new Error('Another Buyer could delete the owner wishlist item.');
  if (rows.find((row) => row.id === WISHLIST_ID) === undefined) throw new Error('Cross-user delete mutated owner item.');

  const removed = await service.remove(principal(BUYER_ID), PRODUCT_ID);
  if (!removed.deleted || removed.productId !== PRODUCT_ID) throw new Error('Owner wishlist removal failed.');

  console.log('the implementation WISHLIST RUNTIME VERIFICATION PASSED');
}

await main();
