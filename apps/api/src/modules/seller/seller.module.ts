import { NotificationsModule } from '../notifications/public/index.js';
import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/index.js';
import { DatabaseTransactionService } from '../../database/database-transaction.service.js';
import { AuthorizationModule } from '../../common/authorization/authorization.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/public/index.js';
import { SellerController } from './seller.controller.js';
import { SellerRepository } from './seller.repository.js';
import { SellerService } from './seller.service.js';
import { SELLER_MODULE_API } from './public/module-api.js';

@Module({
  imports: [NotificationsModule, DatabaseModule, AuditModule, AuthModule, AuthorizationModule],
  controllers: [SellerController],
  providers: [
    SellerRepository,
    SellerService,
    { provide: SELLER_MODULE_API, useExisting: SellerService },
  ],
  exports: [SELLER_MODULE_API],
})
export class SellerModule {}
