import { Injectable } from '@nestjs/common';
import { DatabaseHealthService } from '../database/database-health.service.js';

export type HealthStatus = {
  service: 'tradenest-api';
  status: 'ok';
};

export type ReadinessStatus = {
  service: 'tradenest-api';
  status: 'ready';
  dependencies: {
    postgres: 'ready';
  };
};

@Injectable()
export class HealthService {
  constructor(private readonly databaseHealth: DatabaseHealthService) {}

  getLiveness(): HealthStatus {
    return { service: 'tradenest-api', status: 'ok' };
  }

  async getReadiness(): Promise<ReadinessStatus> {
    await this.databaseHealth.assertReady();

    return {
      service: 'tradenest-api',
      status: 'ready',
      dependencies: {
        postgres: 'ready',
      },
    };
  }
}
