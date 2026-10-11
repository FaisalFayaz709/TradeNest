import 'dotenv/config';
import { AnalyticsService } from '../src/modules/analytics/analytics.service.js';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000001';
const EVENT_ID = '70000000-0000-4000-8000-000000000001';
const now = new Date('2026-10-06T05:00:00.000Z');

async function main(): Promise<void> {
  const rows: any[] = [];
  const checked: string[] = [];
  const repository = {
    async createBehaviorEvent(input: any) {
      const row = { id: EVENT_ID, metadata: null, occurredAt: now, ...input };
      rows.push(row);
      return row;
    },
  };
  const catalog = {
    async requireBehaviorEventProduct(productId: string) {
      if (productId !== PRODUCT_ID) throw new Error('Unexpected product ID.');
      checked.push(productId);
    },
  };
  const service = new AnalyticsService(repository as never, {} as never, catalog as never, {} as never);

  const anonymous = await service.ingestBehaviorEvent(undefined, { eventType: 'PRODUCT_VIEW', productId: PRODUCT_ID });
  if (anonymous.id !== EVENT_ID || anonymous.productId !== PRODUCT_ID || anonymous.eventType !== 'PRODUCT_VIEW') {
    throw new Error('Anonymous behavior event receipt is incorrect.');
  }
  if ('userId' in anonymous || 'metadata' in anonymous || 'score' in anonymous) {
    throw new Error('Behavior event receipt leaked internal identity/metadata/scoring fields.');
  }
  if (rows[0]?.userId !== null) throw new Error('Anonymous event must persist userId as null.');

  const principal = {
    userId: USER_ID,
    sessionId: '20000000-0000-4000-8000-000000000001',
    email: 'buyer@example.invalid',
    name: 'Buyer',
    role: 'BUYER' as const,
  };
  for (const eventType of ['WISHLIST', 'ADD_TO_CART'] as const) {
    await service.ingestBehaviorEvent(principal, { eventType, productId: PRODUCT_ID });
  }
  if (rows.slice(1).some((row) => row.userId !== USER_ID)) throw new Error('Authenticated event did not use server principal identity.');
  if (rows.length !== 3 || checked.length !== 3) throw new Error('Every accepted event must validate its product before persistence.');
  let purchaseRejected = false;
  try { await service.ingestBehaviorEvent(principal, { eventType: 'PURCHASE', productId: PRODUCT_ID }); }
  catch { purchaseRejected = true; }
  if (!purchaseRejected || rows.length !== 3) throw new Error('Client PURCHASE spoofing must be rejected before write.');

  console.log('the implementation BEHAVIOR EVENT RUNTIME VERIFICATION PASSED');
}

await main();
