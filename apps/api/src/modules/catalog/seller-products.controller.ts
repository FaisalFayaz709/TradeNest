import { ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SellerProductQuerySchema, type SellerProductQuery } from '@tradenest/contracts/products';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { CatalogService } from './catalog.service.js';

@Controller('seller/products')
@UseGuards(AccessTokenGuard, RolesGuard)
@RequireRoles('SELLER')
@ApiBearerAuth()
export class SellerProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  async list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query(new ZodValidationPipe(SellerProductQuerySchema)) query: SellerProductQuery,
  ) {
    return this.catalog.listSellerProducts(principal, query);
  }
}
