import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { AnalyticsRepository } from '../src/modules/analytics/analytics.repository.js';
import { CatalogRepository } from '../src/modules/catalog/catalog.repository.js';
import { PrismaService } from '../src/database/prisma.service.js';

async function main(): Promise<void> {
  const prisma = new PrismaService();
  try {
    const analytics = new AnalyticsRepository(prisma);
    const catalog = new CatalogRepository(prisma);
    const unknownProduct = randomUUID();
    const unknownCategory = randomUUID();
    const signals = await analytics.smartPricingSignals(unknownProduct);
    if (signals.productViews !== 0 || signals.addToCartEvents !== 0 || signals.completedOrders !== 0 || signals.completedUnitsSold !== 0) {
      throw new Error('Unknown product smart-pricing signals must resolve to zero aggregates.');
    }
    const comparables = await catalog.listSmartPricingComparables(unknownCategory, 'USD', unknownProduct, 100);
    if (comparables.length !== 0) throw new Error('Unknown category unexpectedly returned smart-pricing comparables.');
    console.log('the implementation SMART PRICING DATABASE VERIFICATION PASSED');
  } finally {
    await prisma.$disconnect();
  }
}

await main();
