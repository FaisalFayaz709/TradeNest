import { Controller, Get, Headers, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { UuidSchema } from '@tradenest/contracts/common';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit/index.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { EscrowCommandsService } from './escrow-commands.service.js';

@Controller()
@UseGuards(AccessTokenGuard, RolesGuard)
@ApiBearerAuth()
export class EscrowController {
  constructor(private readonly commands: EscrowCommandsService) {}

  @Get('orders/:orderId/escrow')
  @RequireRoles('BUYER', 'SELLER', 'ADMIN')
  async getForOrder(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('orderId', new ZodValidationPipe(UuidSchema)) orderId: string,
  ) {
    return { data: await this.commands.getForOrder(principal, orderId) };
  }

  @Post('escrows/:id/release')
  @RateLimit('ADMIN_SENSITIVE_PRINCIPAL')
  @UseGuards(RateLimitGuard)
  @RequireRoles('ADMIN')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Stable retry key for escrow release.' })
  async release(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return { data: await this.commands.release(principal, id, idempotencyKey, requestId) };
  }

  @Post('escrows/:id/refund')
  @HttpCode(202)
  @RateLimit('ADMIN_SENSITIVE_PRINCIPAL')
  @UseGuards(RateLimitGuard)
  @RequireRoles('ADMIN')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Stable retry key for escrow refund.' })
  async refund(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return { data: await this.commands.refund(principal, id, idempotencyKey, requestId), meta: { refund: 'PENDING_PROVIDER_CONFIRMATION' } };
  }
}
