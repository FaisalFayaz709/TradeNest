import { ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OrderListQuerySchema, type OrderListQuery } from '@tradenest/contracts/orders';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { OrdersService } from './orders.service.js';

@Controller('seller/orders')
@UseGuards(AccessTokenGuard, RolesGuard)
@RequireRoles('SELLER')
@ApiBearerAuth()
export class SellerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  async list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query(new ZodValidationPipe(OrderListQuerySchema)) query: OrderListQuery,
  ) {
    return this.orders.listSellerOrders(principal, query);
  }
}
