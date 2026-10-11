import { NotificationsModule } from '../notifications/public/index.js';
import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/index.js';
import { AuthorizationModule } from '../../common/authorization/authorization.module.js';
import { IdempotencyModule } from '../../common/idempotency/index.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/public/index.js';
import { OrdersModule } from '../orders/public/index.js';
import { PaymentsModule } from '../payments/public/index.js';
import { DisputesModule } from '../disputes/public/index.js';
import { EscrowCommandsService } from './escrow-commands.service.js';
import { EscrowController } from './escrow.controller.js';
import { EscrowRepository } from './escrow.repository.js';
import { RefundOperationRepository } from './refund-operation.repository.js';
import { RefundReconciliationService } from './refund-reconciliation.service.js';
import { EscrowService } from './escrow.service.js';
import { ESCROW_MODULE_API } from './public/module-api.js';

@Module({
  imports: [NotificationsModule,
    AuthModule,
    AuthorizationModule,
    DatabaseModule,
    IdempotencyModule,
    AuditModule,
    forwardRef(() => OrdersModule),
    forwardRef(() => PaymentsModule),
    forwardRef(() => DisputesModule),
  ],
  controllers: [EscrowController],
  providers: [
    EscrowRepository,
    RefundOperationRepository,
    RefundReconciliationService,
    EscrowService,
    EscrowCommandsService,
    { provide: ESCROW_MODULE_API, useExisting: EscrowService },
  ],
  exports: [ESCROW_MODULE_API],
})
export class EscrowModule {}
