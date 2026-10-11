import { NotificationsModule } from '../notifications/public/index.js';
import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module.js';
import { IdempotencyModule } from '../../common/idempotency/index.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/public/index.js';
import { CartModule } from '../cart/public/index.js';
import { CatalogModule } from '../catalog/public/index.js';
import { DisputesModule } from '../disputes/public/index.js';
import { EscrowModule } from '../escrow/public/index.js';
import { PaymentsModule } from '../payments/public/index.js';
import { SellerModule } from '../seller/public/index.js';
import { ShippingModule } from '../shipping/public/index.js';
import { UsersModule } from '../users/public/index.js';
import { CheckoutController } from './checkout.controller.js';
import { OrdersController } from './orders.controller.js';
import { SellerOrdersController } from './seller-orders.controller.js';
import { ReviewsController } from './reviews.controller.js';
import {
  CHECKOUT_PRICING_POLICY,
  MvpZeroAdjustmentCheckoutPricingPolicy,
} from './checkout-pricing.policy.js';
import { CheckoutService } from './checkout.service.js';
import { OrdersPublicService } from './orders-public.service.js';
import { OrdersService } from './orders.service.js';
import { OrdersRepository } from './orders.repository.js';
import { OrderExpirationService } from './order-expiration.service.js';
import { ReviewsRepository } from './reviews.repository.js';
import { ReviewsService } from './reviews.service.js';
import { ORDERS_MODULE_API } from './public/module-api.js';

@Module({
  imports: [NotificationsModule,
    AuthModule,
    AuthorizationModule,
    DatabaseModule,
    IdempotencyModule,
    CartModule,
    CatalogModule,
    SellerModule,
    UsersModule,
    forwardRef(() => DisputesModule),
    forwardRef(() => PaymentsModule),
    forwardRef(() => EscrowModule),
    forwardRef(() => ShippingModule),
  ],
  controllers: [CheckoutController, OrdersController, SellerOrdersController, ReviewsController],
  providers: [
    OrdersRepository,
    OrdersPublicService,
    OrdersService,
    ReviewsRepository,
    ReviewsService,
    CheckoutService,
    OrderExpirationService,
    MvpZeroAdjustmentCheckoutPricingPolicy,
    { provide: ORDERS_MODULE_API, useExisting: OrdersPublicService },
    { provide: CHECKOUT_PRICING_POLICY, useExisting: MvpZeroAdjustmentCheckoutPricingPolicy },
  ],
  exports: [ORDERS_MODULE_API],
})
export class OrdersModule {}
