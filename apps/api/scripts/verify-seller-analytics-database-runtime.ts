import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { AnalyticsRepository } from '../src/modules/analytics/analytics.repository.js';
import { PrismaService } from '../src/database/prisma.service.js';

async function main(): Promise<void> {
  const prisma = new PrismaService();
  try {
    const repository = new AnalyticsRepository(prisma);
    const sellerId = randomUUID();
    const [revenue, sold, statuses, views, top, low, escrow] = await Promise.all([
      repository.sellerRevenueByCurrency(sellerId),
      repository.sellerProductsSold(sellerId),
      repository.sellerOrderStatusDistribution(sellerId),
      repository.sellerProductViews(sellerId),
      repository.sellerTopProducts(sellerId, 5),
      repository.sellerLowStockProducts(sellerId, 5, 20),
      repository.sellerEscrowByStatus(sellerId),
    ]);
    if (revenue.length || statuses.length || top.length || low.length || escrow.length) throw new Error('Unknown seller unexpectedly returned analytics rows.');
    if (sold.productsSold !== 0 || views.productViews !== 0) throw new Error('Unknown seller aggregate defaults are incorrect.');
    console.log('the implementation SELLER ANALYTICS DATABASE VERIFICATION PASSED');
  } finally {
    await prisma.$disconnect();
  }
}

await main();
