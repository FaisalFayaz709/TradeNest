import { ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('seller/analytics')
@UseGuards(AccessTokenGuard, RolesGuard)
@RequireRoles('SELLER')
@ApiBearerAuth()
export class SellerAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  async getAnalytics(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.analytics.sellerAnalytics(principal) };
  }

  @Get('overview')
  async overview(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.analytics.sellerAnalytics(principal) };
  }

  @Get('revenue')
  async revenue(@CurrentPrincipal() principal: AuthPrincipal) {
    const analytics = await this.analytics.sellerAnalytics(principal);
    return { data: { generatedAt: analytics.generatedAt, revenueByCurrency: analytics.kpis.revenueByCurrency, averageOrderValueByCurrency: analytics.kpis.averageOrderValueByCurrency } };
  }
}
