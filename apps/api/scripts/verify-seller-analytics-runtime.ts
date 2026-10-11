import 'dotenv/config';

process.env.DATABASE_URL ??= 'postgresql://tradenest:tradenest_local_only@127.0.0.1:5432/tradenest?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'analytics-runtime-jwt-secret-at-least-32-characters';
process.env.CATALOG_DEFAULT_CURRENCY ??= 'USD';
process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET ??= 'analytics-runtime-payment-secret-at-least-32-chars';
process.env.SELLER_ANALYTICS_LOW_STOCK_THRESHOLD ??= '5';

const { AnalyticsService } = await import('../src/modules/analytics/analytics.service.js');
const { AuthorizationService } = await import('../src/common/authorization/authorization.service.js');

const SELLER_ID = '10000000-0000-4000-8000-000000000027';
const PRODUCT_ID = '40000000-0000-4000-8000-000000000027';

async function main(): Promise<void> {
  const repository = {
    async sellerRevenueByCurrency() {
      return [
        { currency: 'PKR', amount: '1500.00', orderCount: 1, averageOrderValue: '1500.00' },
        { currency: 'USD', amount: '30.00', orderCount: 2, averageOrderValue: '15.00' },
      ];
    },
    async sellerProductsSold() { return { productsSold: 7 }; },
    async sellerOrderStatusDistribution() {
      return [
        { status: 'COMPLETED' as const, count: 2 },
        { status: 'SHIPPED' as const, count: 1 },
      ];
    },
    async sellerProductViews() { return { productViews: 10 }; },
    async sellerTopProducts() {
      return [{ productId: PRODUCT_ID, productName: 'Keyboard', sku: 'KB-1', unitsSold: 5 }];
    },
    async sellerTopProductRevenue() {
      return [
        { productId: PRODUCT_ID, currency: 'PKR', amount: '1500.00' },
        { productId: PRODUCT_ID, currency: 'USD', amount: '20.00' },
      ];
    },
    async sellerLowStockProducts() {
      return [{ productId: PRODUCT_ID, productName: 'Keyboard', sku: 'KB-1', availableQuantity: 2, reservedQuantity: 1 }];
    },
    async sellerEscrowByStatus() {
      return [{ status: 'HELD' as const, currency: 'USD', count: 1, amount: '15.00' }];
    },
  };
  let sellerChecks = 0;
  const sellers = {
    async requireSellerProfile(userId: string) {
      if (userId !== SELLER_ID) throw new Error('Unexpected seller identity.');
      sellerChecks += 1;
      return { userId, storeName: 'Store', slug: 'store', status: 'ACTIVE' };
    },
  };
  const service = new AnalyticsService(repository as never, new AuthorizationService(), {} as never, sellers as never);
  const principal = {
    userId: SELLER_ID,
    sessionId: '20000000-0000-4000-8000-000000000027',
    email: 'seller@example.invalid',
    name: 'Seller',
    role: 'SELLER' as const,
  };

  const result = await service.sellerAnalytics(principal);
  if (sellerChecks !== 1) throw new Error('Seller profile policy was not checked.');
  if (result.kpis.orderCount !== 3 || result.kpis.productsSold !== 7) throw new Error('Seller KPI counts are incorrect.');
  if (result.kpis.conversionRatePercent !== 20) throw new Error(`Expected conversion rate 20, got ${result.kpis.conversionRatePercent}.`);
  if (result.kpis.revenueByCurrency.length !== 2) throw new Error('Multi-currency revenue must remain separated.');
  if (result.kpis.revenueByCurrency.some((row) => row.amount.includes(','))) throw new Error('Money must remain decimal strings.');
  if (result.topProducts[0]?.revenueByCurrency.length !== 2) throw new Error('Top-product revenue lost currency grouping.');
  if (result.lowStockThreshold !== 5 || result.lowStockProducts[0]?.availableQuantity !== 2) throw new Error('Low-stock policy mismatch.');
  if ('aiInsights' in result || 'priceSuggestion' in result) throw new Error('the implementation must not mix AI insights into authoritative seller analytics.');

  let forbidden = false;
  try { await service.sellerAnalytics({ ...principal, role: 'BUYER' }); } catch { forbidden = true; }
  if (!forbidden) throw new Error('Seller analytics must be SELLER-only.');

  console.log('the implementation SELLER ANALYTICS RUNTIME VERIFICATION PASSED');
}

await main();
