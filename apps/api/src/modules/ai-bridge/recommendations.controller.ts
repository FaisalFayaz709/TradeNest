import { ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RecommendationQuerySchema, type RecommendationQuery } from '@tradenest/contracts/ai';
import { UuidSchema } from '@tradenest/contracts/common';
import { RequireRoles, RolesGuard } from '../../common/authorization/index.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { RateLimit, RateLimitGuard } from '../../common/rate-limit/index.js';
import { AccessTokenGuard, CurrentPrincipal, type AuthPrincipal } from '../auth/public/index.js';
import { AIBridgeService } from './ai-bridge.service.js';

@Controller('ai/recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: AIBridgeService) {}

  @Get()
  @RateLimit('AI_PERSONALIZED_PRINCIPAL')
  @UseGuards(AccessTokenGuard, RateLimitGuard, RolesGuard)
  @RequireRoles('BUYER')
  @ApiBearerAuth()
  async personalized(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query(new ZodValidationPipe(RecommendationQuerySchema)) query: RecommendationQuery,
  ) {
    return { data: await this.recommendations.personalized(principal, query) };
  }

  @Get('products/:id')
  @RateLimit('AI_SIMILAR_IP')
  @UseGuards(RateLimitGuard)
  async similar(
    @Param('id', new ZodValidationPipe(UuidSchema)) productId: string,
    @Query(new ZodValidationPipe(RecommendationQuerySchema)) query: RecommendationQuery,
  ) {
    return { data: await this.recommendations.similar(productId, query) };
  }
}
