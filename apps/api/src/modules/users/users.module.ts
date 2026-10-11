import { NotificationsModule } from '../notifications/public/index.js';
import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/index.js';
import { AuthorizationModule } from '../../common/authorization/authorization.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { DatabaseTransactionService } from '../../database/database-transaction.service.js';
import { AuthModule } from '../auth/public/index.js';
import { CatalogModule } from '../catalog/public/index.js';
import { UsersController } from './users.controller.js';
import { WishlistController } from './wishlist.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';
import { WishlistService } from './wishlist.service.js';
import { USERS_MODULE_API } from './public/module-api.js';

@Module({
  imports: [NotificationsModule, DatabaseModule, AuditModule, AuthModule, AuthorizationModule, CatalogModule],
  controllers: [UsersController, WishlistController],
  providers: [UsersRepository, UsersService, WishlistService, { provide: USERS_MODULE_API, useExisting: UsersService }],
  exports: [USERS_MODULE_API],
})
export class UsersModule {}
