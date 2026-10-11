import { Controller, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { UuidSchema } from '@tradenest/contracts/common';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit/index.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { PaymentsService } from './payments.service.js';

@Controller('orders/:orderId/payments')
@UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
@RequireRoles('BUYER')
@ApiBearerAuth()
export class OrderPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @RateLimit('PAYMENT_CREATE_PRINCIPAL')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Stable retry key for payment creation.' })
  async create(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('orderId', new ZodValidationPipe(UuidSchema)) orderId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return { data: await this.payments.initiate(principal, orderId, idempotencyKey) };
  }
}
