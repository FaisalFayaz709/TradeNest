import 'dotenv/config';
import { randomUUID } from 'node:crypto';

process.env.DATABASE_URL ??= 'postgresql://tradenest:tradenest_local_only@127.0.0.1:5432/tradenest?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'review-runtime-jwt-secret-at-least-32-characters';

const { ReviewsService } = await import('../src/modules/orders/reviews.service.js');
const { AuthorizationService } = await import('../src/common/authorization/authorization.service.js');
const { ApiException } = await import('../src/common/http/api-exception.js');

const BUYER_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_BUYER_ID = '10000000-0000-4000-8000-000000000009';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const ORDER_ITEM_ID = '30000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
const REVIEW_ID = '50000000-0000-4000-8000-000000000001';
const now = new Date('2026-10-05T20:00:00.000Z');

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
  let status = 'COMPLETED';
  let stored: any = null;
  const orders = {
    async findReviewPurchaseContext(orderId: string, orderItemId: string) {
      if (orderId !== ORDER_ID || orderItemId !== ORDER_ITEM_ID) return null;
      return { buyerId: BUYER_ID, status, orderItemId: ORDER_ITEM_ID, productId: PRODUCT_ID };
    },
  };
  const reviews = {
    async listByProduct(productId: string, page: number, limit: number) {
      const rows = stored && stored.productId === productId ? [stored] : [];
      return { rows: rows.slice((page - 1) * limit, page * limit), total: rows.length };
    },
    async findByOrderItem(orderItemId: string) {
      return stored?.orderItemId === orderItemId ? stored : null;
    },
    async create(input: any) {
      stored = { id: REVIEW_ID, ...input, createdAt: now, updatedAt: now };
      return stored;
    },
  };

  const service = new ReviewsService(reviews as never, orders as never, new AuthorizationService());
  const created = await service.create(principal(BUYER_ID), ORDER_ID, {
    orderItemId: ORDER_ITEM_ID,
    rating: 5,
    comment: 'Verified completed purchase.',
  });
  if (created.productId !== PRODUCT_ID || created.rating !== 5) throw new Error('Review did not derive product/rating correctly.');
  if ('buyerId' in created || 'orderItemId' in created) throw new Error('Public review response leaked buyer/order-item identifiers.');

  const page = await service.listProductReviews(PRODUCT_ID, { page: 1, limit: 20 });
  if (page.data.length !== 1 || page.meta.total !== 1 || page.data[0]?.id !== REVIEW_ID) throw new Error('Public review listing failed.');

  let duplicate = false;
  try {
    await service.create(principal(BUYER_ID), ORDER_ID, { orderItemId: ORDER_ITEM_ID, rating: 4 });
  } catch (error) {
    assertApiError(error, 409, 'REVIEW_ALREADY_EXISTS');
    duplicate = true;
  }
  if (!duplicate) throw new Error('Duplicate order-item review was accepted.');

  stored = null;
  status = 'DELIVERED';
  let incomplete = false;
  try {
    await service.create(principal(BUYER_ID), ORDER_ID, { orderItemId: ORDER_ITEM_ID, rating: 4 });
  } catch (error) {
    assertApiError(error, 409, 'REVIEW_NOT_ELIGIBLE');
    incomplete = true;
  }
  if (!incomplete) throw new Error('Non-completed order item was reviewable.');

  status = 'COMPLETED';
  let concealed = false;
  try {
    await service.create(principal(OTHER_BUYER_ID), ORDER_ID, { orderItemId: ORDER_ITEM_ID, rating: 3 });
  } catch (error) {
    assertApiError(error, 404, 'ORDER_ITEM_NOT_FOUND');
    concealed = true;
  }
  if (!concealed) throw new Error('Another buyer could review someone else\'s purchased item.');

  console.log('the implementation REVIEWS RUNTIME VERIFICATION PASSED');
}

await main();
