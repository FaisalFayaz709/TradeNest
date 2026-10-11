import { Module } from '@nestjs/common';
import { DatabaseHealthService } from './database-health.service.js';
import { DatabaseTransactionService } from './database-transaction.service.js';
import { PrismaService } from './prisma.service.js';

@Module({
  providers: [PrismaService, DatabaseHealthService, DatabaseTransactionService],
  exports: [PrismaService, DatabaseHealthService, DatabaseTransactionService],
})
export class DatabaseModule {}
