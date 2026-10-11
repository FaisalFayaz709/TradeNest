import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../../generated/prisma/client.js';

export interface StoredIdempotencyRecord {
  requestHash: string | null;
  response: unknown | null;
}

@Injectable()
export class IdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  hashKey(key: string): string {
    return createHash('sha256').update(key, 'utf8').digest('hex');
  }

  async findRecord(
    userId: string,
    operation: string,
    keyHash: string,
    transaction?: DatabaseTransactionContext,
  ): Promise<StoredIdempotencyRecord | null> {
    const row = await (transaction?.client ?? this.prisma).idempotencyRecord.findUnique({
      where: { userId_operation_keyHash: { userId, operation, keyHash } },
      select: { requestHash: true, response: true },
    });
    return row ? { requestHash: row.requestHash, response: row.response } : null;
  }

  /** Used only by payment-initiation recovery, under its locked order row.
   * A second header must not take ownership of another uncompleted claim.
   */
  async hasCompetingUnfinishedClaim(
    userId: string, operation: string, requestHash: string, keyHash: string,
    transaction: DatabaseTransactionContext,
  ): Promise<boolean> {
    const records = await transaction.client.idempotencyRecord.findMany({
      where: { userId, operation, requestHash, keyHash: { not: keyHash } },
      select: { response: true },
    });
    return records.some((record) => record.response === null);
  }

  async createClaim(
    userId: string,
    operation: string,
    keyHash: string,
    requestHash: string,
    transaction: DatabaseTransactionContext,
  ): Promise<void> {
    await transaction.client.idempotencyRecord.create({
      data: {
        userId,
        operation,
        keyHash,
        requestHash,
        response: Prisma.DbNull,
      },
    });
  }

  async completeClaim(
    userId: string,
    operation: string,
    keyHash: string,
    response: unknown,
    transaction: DatabaseTransactionContext,
  ): Promise<void> {
    await transaction.client.idempotencyRecord.update({
      where: { userId_operation_keyHash: { userId, operation, keyHash } },
      data: { response: response as Prisma.InputJsonValue },
    });
  }
}
