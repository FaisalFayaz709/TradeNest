import { ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UuidSchema } from '@tradenest/contracts/common';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit/index.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { AIBridgeService } from './ai-bridge.service.js';

@Controller()
export class PricingController {
  constructor(private readonly ai: AIBridgeService) {}

  @Post('seller/products/:id/price-suggestion')
  @RateLimit('AI_PRICING_PRINCIPAL')
  @UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
  @RequireRoles('SELLER')
  @ApiBearerAuth()
  async sellerProductSuggestion(@CurrentPrincipal() principal: AuthPrincipal, @Param('id', new ZodValidationPipe(UuidSchema)) productId: string) {
    return { data: await this.ai.smartPricing(principal, productId) };
  }

  @Get('seller/ai-insights')
  @RateLimit('AI_PRICING_PRINCIPAL')
  @UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
  @RequireRoles('SELLER')
  @ApiBearerAuth()
  async sellerInsights(@CurrentPrincipal() principal: AuthPrincipal) {
    return { data: await this.ai.smartPricingInsights(principal) };
  }

  @Get('ai/pricing/products/:id')
  @RateLimit('AI_PRICING_PRINCIPAL')
  @UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
  @RequireRoles('SELLER')
  @ApiBearerAuth()
  async productSuggestion(@CurrentPrincipal() principal: AuthPrincipal, @Param('id', new ZodValidationPipe(UuidSchema)) productId: string) {
    return { data: await this.ai.smartPricing(principal, productId) };
  }
}
