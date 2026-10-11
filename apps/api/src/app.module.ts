import { Module } from '@nestjs/common';
import { ObservabilityModule } from './common/observability/index.js';
import { RateLimitModule } from './common/rate-limit/index.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AIBridgeModule } from './modules/ai-bridge/ai-bridge.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { DisputesModule } from './modules/disputes/disputes.module.js';
import { EscrowModule } from './modules/escrow/escrow.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { SellerModule } from './modules/seller/seller.module.js';
import { ShippingModule } from './modules/shipping/shipping.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ObservabilityModule,
    RateLimitModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    EscrowModule,
    ShippingModule,
    DisputesModule,
    SellerModule,
    AnalyticsModule,
    AIBridgeModule,
    AdminModule,
    NotificationsModule,
  ],
})
export class AppModule {}
