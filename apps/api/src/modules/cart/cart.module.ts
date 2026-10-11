import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/public/index.js';
import { CatalogModule } from '../catalog/public/index.js';
import { CartController } from './cart.controller.js';
import { CartRepository } from './cart.repository.js';
import { CartService } from './cart.service.js';
import { CART_MODULE_API } from './public/module-api.js';

@Module({
  imports: [DatabaseModule, AuthModule, AuthorizationModule, CatalogModule],
  controllers: [CartController],
  providers: [
    CartRepository,
    CartService,
    { provide: CART_MODULE_API, useExisting: CartService },
  ],
  exports: [CART_MODULE_API],
})
export class CartModule {}
