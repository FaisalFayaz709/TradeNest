import { ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { DisputesService } from './disputes.service.js';

@Controller('seller/disputes')
@UseGuards(AccessTokenGuard, RolesGuard)
@RequireRoles('SELLER')
@ApiBearerAuth()
export class SellerDisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  async list(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.disputes.listSellerDisputes(principal) };
  }
}
