import { NotificationsModule } from '../notifications/public/index.js';
import { forwardRef, Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/index.js';
import { AuditModule } from '../../common/audit/index.js';
import { AuthorizationModule } from '../../common/authorization/authorization.module.js';
import { IdempotencyModule } from '../../common/idempotency/index.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/public/index.js';
import { EscrowModule } from '../escrow/public/index.js';
import { OrdersModule } from '../orders/public/index.js';
import { DisputesController } from './disputes.controller.js';
import { SellerDisputesController } from './seller-disputes.controller.js';
import { DisputesRepository } from './disputes.repository.js';
import { DisputesService } from './disputes.service.js';
import { DISPUTES_MODULE_API } from './public/module-api.js';

@Module({
  imports: [NotificationsModule,
    StorageModule,
    AuthModule,
    AuthorizationModule,
    DatabaseModule,
    IdempotencyModule,
    AuditModule,
    forwardRef(() => OrdersModule),
    forwardRef(() => EscrowModule),
  ],
  controllers: [DisputesController, SellerDisputesController],
  providers: [
    DisputesRepository,
    DisputesService,
    { provide: DISPUTES_MODULE_API, useExisting: DisputesService },
  ],
  exports: [DISPUTES_MODULE_API],
})
export class DisputesModule {}
