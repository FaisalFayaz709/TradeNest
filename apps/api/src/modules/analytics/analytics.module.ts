import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/public/index.js';
import { CatalogModule } from '../catalog/public/index.js';
import { SellerModule } from '../seller/public/index.js';
import { AnalyticsRepository } from './analytics.repository.js';
import { AnalyticsService } from './analytics.service.js';
import { EventsController } from './events.controller.js';
import { SellerAnalyticsController } from './seller-analytics.controller.js';
import { ANALYTICS_MODULE_API } from './public/module-api.js';

@Module({
  imports: [DatabaseModule, AuthModule, AuthorizationModule, CatalogModule, SellerModule],
  controllers: [EventsController, SellerAnalyticsController],
  providers: [
    AnalyticsRepository,
    AnalyticsService,
    { provide: ANALYTICS_MODULE_API, useExisting: AnalyticsService },
  ],
  exports: [ANALYTICS_MODULE_API],
})
export class AnalyticsModule {}
