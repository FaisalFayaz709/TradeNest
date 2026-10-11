import { NotificationsModule } from '../notifications/public/index.js';
import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/index.js';
import { AuditModule } from '../../common/audit/index.js';
import { AuthorizationModule } from '../../common/authorization/authorization.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/public/index.js';
import { SellerModule } from '../seller/public/index.js';
import { CatalogRepository } from './catalog.repository.js';
import { CatalogService } from './catalog.service.js';
import { CategoriesController } from './categories.controller.js';
import { ProductsController } from './products.controller.js';
import { SellerProductsController } from './seller-products.controller.js';
import { CATALOG_MODULE_API } from './public/module-api.js';

@Module({
  imports: [NotificationsModule, StorageModule, DatabaseModule, AuditModule, AuthModule, AuthorizationModule, SellerModule],
  controllers: [CategoriesController, ProductsController, SellerProductsController],
  providers: [
    CatalogRepository,
    CatalogService,
    { provide: CATALOG_MODULE_API, useExisting: CatalogService },
  ],
  exports: [CATALOG_MODULE_API],
})
export class CatalogModule {}
