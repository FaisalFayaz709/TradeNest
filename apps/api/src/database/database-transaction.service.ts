import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from './prisma.service.js';

/**
 * Opaque transaction handle passed across module public seams.
 * Application services may pass this object around, but only repositories
 * should use its Prisma transaction client.
 */
export class DatabaseTransactionContext {
  constructor(public readonly client: Prisma.TransactionClient) {}
}

@Injectable()
export class DatabaseTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async runSerializable<T>(work: (transaction: DatabaseTransactionContext) => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (client) => work(new DatabaseTransactionContext(client)),
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        if (attempt < maxAttempts && this.isRetryableWriteConflict(error)) continue;
        throw error;
      }
    }
    throw new Error('Serializable transaction retry loop exhausted unexpectedly.');
  }

  private isRetryableWriteConflict(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2034';
  }
}
