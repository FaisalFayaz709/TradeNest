import { Test, type TestingModule } from '@nestjs/testing';
import { HealthModule } from '../../src/health/health.module.js';
import { HealthService } from '../../src/health/health.service.js';

const connectionString = process.env.TEST_DATABASE_URL;
const runDatabaseSuite = connectionString ? describe : describe.skip;

runDatabaseSuite('NestJS + PostgreSQL integration wiring', () => {
  let module: TestingModule;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = connectionString!;
    process.env.JWT_ACCESS_SECRET ??= 'test-integration-jwt-secret-at-least-32-characters';
    process.env.CATALOG_DEFAULT_CURRENCY ??= 'USD';
    process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET ??= 'test-integration-webhook-secret-at-least-32-characters';
    module = await Test.createTestingModule({ imports: [HealthModule] }).compile();
    await module.init();
  });

  afterAll(async () => {
    await module?.close();
  });

  it('resolves the NestJS health service and verifies PostgreSQL readiness', async () => {
    const health = module.get(HealthService);
    await expect(health.getReadiness()).resolves.toEqual({
      service: 'tradenest-api',
      status: 'ready',
      dependencies: { postgres: 'ready' },
    });
  });
});
