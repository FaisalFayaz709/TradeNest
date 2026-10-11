import { ApiBearerAuth } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ModerationReasonSchema, type ModerationReasonInput } from '@tradenest/contracts/admin';
import { UuidSchema } from '@tradenest/contracts/common';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit/index.js';
import { OrderListQuerySchema, type OrderListQuery } from '@tradenest/contracts/orders';
import { ProductQuerySchema, type ProductQuery } from '@tradenest/contracts/products';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
@RequireRoles('ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('users/:id/suspend')
  @RateLimit('ADMIN_SENSITIVE_PRINCIPAL')
  @UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
  async suspendUser(@CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(ModerationReasonSchema)) body: ModerationReasonInput) {
    return { data: await this.admin.suspendUser(principal, id, body.reason) };
  }

  @Post('users/:id/reactivate')
  @RateLimit('ADMIN_SENSITIVE_PRINCIPAL')
  @UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
  async reactivateUser(@CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(ModerationReasonSchema)) body: ModerationReasonInput) {
    return { data: await this.admin.reactivateUser(principal, id, body.reason) };
  }

  @Post('sellers/:id/suspend')
  @RateLimit('ADMIN_SENSITIVE_PRINCIPAL')
  @UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
  async suspendSeller(@CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(ModerationReasonSchema)) body: ModerationReasonInput) {
    return { data: await this.admin.suspendSeller(principal, id, body.reason) };
  }

  @Post('sellers/:id/reactivate')
  @RateLimit('ADMIN_SENSITIVE_PRINCIPAL')
  @UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
  async reactivateSeller(@CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(ModerationReasonSchema)) body: ModerationReasonInput) {
    return { data: await this.admin.reactivateSeller(principal, id, body.reason) };
  }

  @Post('products/:id/suspend')
  @RateLimit('ADMIN_SENSITIVE_PRINCIPAL')
  @UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
  async suspendProduct(@CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(ModerationReasonSchema)) body: ModerationReasonInput) {
    return { data: await this.admin.suspendProduct(principal, id, body.reason) };
  }

  @Post('products/:id/reactivate')
  @RateLimit('ADMIN_SENSITIVE_PRINCIPAL')
  @UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
  async reactivateProduct(@CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Body(new ZodValidationPipe(ModerationReasonSchema)) body: ModerationReasonInput) {
    return { data: await this.admin.reactivateProduct(principal, id, body.reason) };
  }

  @Get('dashboard')
  async dashboard(@CurrentPrincipal() principal: AuthPrincipal) { return { data: await this.admin.dashboard(principal) }; }

  @Get('users')
  async users(@CurrentPrincipal() principal: AuthPrincipal, @Query(new ZodValidationPipe(OrderListQuerySchema)) query: OrderListQuery) { return this.admin.usersList(principal, query.page, query.limit); }

  @Get('sellers')
  async sellers(@CurrentPrincipal() principal: AuthPrincipal, @Query(new ZodValidationPipe(OrderListQuerySchema)) query: OrderListQuery) { return this.admin.sellersList(principal, query.page, query.limit); }

  @Get('products')
  async products(@CurrentPrincipal() principal: AuthPrincipal, @Query(new ZodValidationPipe(ProductQuerySchema)) query: ProductQuery) { return this.admin.productsList(principal, query); }

  @Get('orders')
  async orders(@CurrentPrincipal() principal: AuthPrincipal, @Query(new ZodValidationPipe(OrderListQuerySchema)) query: OrderListQuery) { return this.admin.ordersList(principal, query.page, query.limit); }

  @Get('payments')
  async payments(@CurrentPrincipal() principal: AuthPrincipal, @Query(new ZodValidationPipe(OrderListQuerySchema)) query: OrderListQuery) { return this.admin.paymentsList(principal, query.page, query.limit); }

  @Get('escrows')
  async escrows(@CurrentPrincipal() principal: AuthPrincipal, @Query(new ZodValidationPipe(OrderListQuerySchema)) query: OrderListQuery) { return this.admin.escrowsList(principal, query.page, query.limit); }

  @Get('disputes')
  async disputes(@CurrentPrincipal() principal: AuthPrincipal, @Query(new ZodValidationPipe(OrderListQuerySchema)) query: OrderListQuery) { return this.admin.disputesList(principal, query.page, Math.min(query.limit, 100)); }
}
