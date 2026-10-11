import { ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FraudAlertListSchema, FraudAlertQuerySchema, type FraudAlertQuery } from '@tradenest/contracts/ai';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { AdminService } from './admin.service.js';

@Controller('admin/fraud-alerts')
@UseGuards(AccessTokenGuard, RolesGuard)
@RequireRoles('ADMIN')
@ApiBearerAuth()
export class AdminFraudAlertsController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  async list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query(new ZodValidationPipe(FraudAlertQuerySchema)) query: FraudAlertQuery,
  ) {
    return { data: FraudAlertListSchema.parse({ items: await this.admin.fraudAlerts(principal, query) }) };
  }
}
