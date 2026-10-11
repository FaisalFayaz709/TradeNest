import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { CreateCheckoutSchema, type CreateCheckoutInput } from '@tradenest/contracts/checkout';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit/index.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { CheckoutService } from './checkout.service.js';

@Controller('checkout')
@UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
@RequireRoles('BUYER')
@ApiBearerAuth()
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('quote')
  async quote(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.checkout.quote(principal) };
  }

  @Post()
  @RateLimit('CHECKOUT_PRINCIPAL')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Stable retry key for this checkout operation.' })
  async create(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(CreateCheckoutSchema)) body: CreateCheckoutInput,
  ) {
    return { data: await this.checkout.create(principal, body, idempotencyKey) };
  }
}
