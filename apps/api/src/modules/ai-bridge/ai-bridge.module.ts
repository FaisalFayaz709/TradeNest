import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/index.js';
import { AnalyticsModule } from '../analytics/public/index.js';
import { AuthModule } from '../auth/public/index.js';
import { CatalogModule } from '../catalog/public/index.js';
import { AIBridgeService } from './ai-bridge.service.js';
import { AiServiceClient } from './ai-service.client.js';
import { RecommendationsController } from './recommendations.controller.js';
import { PricingController } from './pricing.controller.js';
import { A_I_BRIDGE_MODULE_API } from './public/module-api.js';

@Module({
  imports: [AuthModule, AuthorizationModule, AnalyticsModule, CatalogModule],
  controllers: [RecommendationsController, PricingController],
  providers: [
    AiServiceClient,
    AIBridgeService,
    { provide: A_I_BRIDGE_MODULE_API, useExisting: AIBridgeService },
  ],
  exports: [A_I_BRIDGE_MODULE_API],
})
export class AIBridgeModule {}
