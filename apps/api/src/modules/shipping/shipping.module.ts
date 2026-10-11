import { NotificationsModule } from '../notifications/public/index.js';
import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/public/index.js';
import { EscrowModule } from '../escrow/public/index.js';
import { OrdersModule } from '../orders/public/index.js';
import { ShippingController } from './shipping.controller.js';
import { ShippingRepository } from './shipping.repository.js';
import { ShippingService } from './shipping.service.js';
import { SHIPPING_MODULE_API } from './public/module-api.js';

@Module({
  imports: [NotificationsModule, AuthModule, AuthorizationModule, DatabaseModule, forwardRef(() => OrdersModule), forwardRef(() => EscrowModule)],
  controllers: [ShippingController],
  providers: [ShippingRepository, ShippingService, { provide: SHIPPING_MODULE_API, useExisting: ShippingService }],
  exports: [SHIPPING_MODULE_API],
})
export class ShippingModule {}
