import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/index.js';
import { AnalyticsModule } from '../analytics/public/index.js';
import { AuthModule } from '../auth/public/index.js';
import { CatalogModule } from '../catalog/public/index.js';
import { DisputesModule } from '../disputes/public/index.js';
import { EscrowModule } from '../escrow/public/index.js';
import { OrdersModule } from '../orders/public/index.js';
import { PaymentsModule } from '../payments/public/index.js';
import { SellerModule } from '../seller/public/index.js';
import { UsersModule } from '../users/public/index.js';
import { AdminController } from './admin.controller.js';
import { AdminFraudAlertsController } from './admin-fraud-alerts.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [AuthModule, AuthorizationModule, AnalyticsModule, UsersModule, SellerModule, CatalogModule, OrdersModule, PaymentsModule, EscrowModule, DisputesModule],
  controllers: [AdminController, AdminFraudAlertsController],
  providers: [AdminService],
})
export class AdminModule {}
