import { NotificationsModule } from '../notifications/public/index.js';
import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module.js';
import { IdempotencyModule } from '../../common/idempotency/index.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AIBridgeModule } from '../ai-bridge/public/index.js';
import { AuthModule } from '../auth/public/index.js';
import { CatalogModule } from '../catalog/public/index.js';
import { EscrowModule } from '../escrow/public/index.js';
import { OrdersModule } from '../orders/public/index.js';
import { OrderPaymentsController } from './order-payments.controller.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentWebhooksController } from './payment-webhooks.controller.js';
import { PaymentsRepository } from './payments.repository.js';
import { PaymentsService } from './payments.service.js';
import { PaymentProviderRegistry } from './provider/payment-provider.registry.js';
import { SandboxPaymentProvider } from './provider/sandbox-payment.provider.js';
import { StripeCheckoutProvider } from './provider/stripe-checkout.provider.js';
import { PAYMENTS_MODULE_API } from './public/module-api.js';

@Module({
  imports: [NotificationsModule,
    AuthModule,
    AuthorizationModule,
    DatabaseModule,
    IdempotencyModule,
    CatalogModule,
    AIBridgeModule,
    forwardRef(() => EscrowModule),
    forwardRef(() => OrdersModule),
  ],
  controllers: [OrderPaymentsController, PaymentsController, PaymentWebhooksController],
  providers: [
    PaymentsRepository,
    SandboxPaymentProvider,
    StripeCheckoutProvider,
    PaymentProviderRegistry,
    PaymentsService,
    { provide: PAYMENTS_MODULE_API, useExisting: PaymentsService },
  ],
  exports: [PAYMENTS_MODULE_API],
})
export class PaymentsModule {}
