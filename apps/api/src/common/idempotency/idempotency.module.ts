import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { IdempotencyRepository } from './idempotency.repository.js';
import { FinancialIdempotencyService } from './idempotency.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [IdempotencyRepository, FinancialIdempotencyService],
  exports: [FinancialIdempotencyService],
})
export class IdempotencyModule {}
