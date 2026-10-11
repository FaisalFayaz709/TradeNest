import { Controller, Get } from '@nestjs/common';
import { HealthService, type HealthStatus, type ReadinessStatus } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthStatus {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  getReadiness(): Promise<ReadinessStatus> {
    return this.healthService.getReadiness();
  }
}
