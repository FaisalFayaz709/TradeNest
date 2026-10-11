import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { MetricsAccessGuard } from './metrics-access.guard.js';
import { MetricsService, PROMETHEUS_CONTENT_TYPE } from './metrics.service.js';

@Controller('observability')
@UseGuards(MetricsAccessGuard)
export class ObservabilityController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', PROMETHEUS_CONTENT_TYPE)
  getMetrics(): string {
    return this.metrics.renderPrometheus();
  }
}
