import { Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { UuidSchema } from '@tradenest/contracts/common';
import { OrderListQuerySchema, type OrderListQuery } from '@tradenest/contracts/orders';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
@UseGuards(AccessTokenGuard, RolesGuard)
@RequireRoles('BUYER', 'SELLER', 'ADMIN')
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequireRoles('BUYER')
  async list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query(new ZodValidationPipe(OrderListQuerySchema)) query: OrderListQuery,
  ) {
    return this.orders.listBuyerOrders(principal, query);
  }

  @Get(':id')
  async get(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
  ) {
    return { data: await this.orders.getOrder(principal, id) };
  }

  @Post(':id/cancel')
  @RequireRoles('BUYER')
  async cancel(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
  ) {
    return { data: await this.orders.cancel(principal, id) };
  }

  @Post(':id/confirm-delivery')
  @RequireRoles('BUYER')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Stable retry key for buyer delivery confirmation and escrow release.' })
  async confirmDelivery(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return { data: await this.orders.confirmDelivery(principal, id, idempotencyKey, requestId) };
  }
}
