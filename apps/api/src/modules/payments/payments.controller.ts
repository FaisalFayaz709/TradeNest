import { ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UuidSchema } from '@tradenest/contracts/common';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
@UseGuards(AccessTokenGuard, RolesGuard)
@RequireRoles('BUYER', 'ADMIN')
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(':id')
  async get(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', new ZodValidationPipe(UuidSchema)) id: string,
  ) {
    return { data: await this.payments.get(principal, id) };
  }
}
