import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpObservabilityInterceptor } from './http-observability.interceptor.js';
import { MetricsAccessGuard } from './metrics-access.guard.js';
import { MetricsService } from './metrics.service.js';
import { ObservabilityContextService } from './observability-context.service.js';
import { ObservabilityController } from './observability.controller.js';
import { OperationalLoggerService } from './operational-logger.service.js';

@Global()
@Module({
  controllers: [ObservabilityController],
  providers: [
    MetricsService,
    OperationalLoggerService,
    ObservabilityContextService,
    MetricsAccessGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpObservabilityInterceptor,
    },
  ],
  exports: [MetricsService, OperationalLoggerService, ObservabilityContextService],
})
export class ObservabilityModule {}
