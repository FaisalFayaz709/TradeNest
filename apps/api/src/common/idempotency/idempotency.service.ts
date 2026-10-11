import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { ApiException } from '../http/api-exception.js';
import { IdempotencyRepository } from './idempotency.repository.js';

export interface FinancialIdempotencyToken {
  keyHash: string;
  requestHash: string;
}

@Injectable()
export class FinancialIdempotencyService {
  constructor(private readonly repository: IdempotencyRepository) {}

  prepare(key: string, requestIntent: unknown): FinancialIdempotencyToken {
    return {
      keyHash: this.repository.hashKey(key),
      requestHash: this.hashRequestIntent(requestIntent),
    };
  }

  async replayOrThrow<T>(
    userId: string,
    operation: string,
    token: FinancialIdempotencyToken,
    transaction?: DatabaseTransactionContext,
  ): Promise<T | null> {
    const row = await this.repository.findRecord(userId, operation, token.keyHash, transaction);
    if (!row) return null;
    this.assertSameRequest(operation, token.requestHash, row.requestHash);
    if (row.response === null) {
      throw new ApiException(409, {
        code: 'IDEMPOTENCY_OPERATION_IN_PROGRESS',
        message: 'The financial operation for this Idempotency-Key is still in progress.',
        details: { operation },
      });
    }
    return row.response as T;
  }

  /** Payment initiation may resume a previously committed, incomplete claim.
   * The exact request fingerprint must still match. Provider-side idempotency is
   * stable on the payment UUID, not the caller-provided header.
   */
  async replayOrPermitInProgress<T>(
    userId: string,
    operation: string,
    token: FinancialIdempotencyToken,
    transaction?: DatabaseTransactionContext,
  ): Promise<T | null> {
    const row = await this.repository.findRecord(userId, operation, token.keyHash, transaction);
    if (!row) return null;
    this.assertSameRequest(operation, token.requestHash, row.requestHash);
    return row.response as T | null;
  }

  async claimOrResume<T>(
    userId: string,
    operation: string,
    token: FinancialIdempotencyToken,
    transaction: DatabaseTransactionContext,
  ): Promise<T | null> {
    const row = await this.repository.findRecord(userId, operation, token.keyHash, transaction);
    if (row) {
      this.assertSameRequest(operation, token.requestHash, row.requestHash);
      return row.response as T | null;
    }
    await this.repository.createClaim(userId, operation, token.keyHash, token.requestHash, transaction);
    return null;
  }

  async hasCompetingUnfinishedClaim(
    userId: string, operation: string, token: FinancialIdempotencyToken,
    transaction: DatabaseTransactionContext,
  ): Promise<boolean> {
    return this.repository.hasCompetingUnfinishedClaim(
      userId, operation, token.requestHash, token.keyHash, transaction,
    );
  }

  async claimOrReplay<T>(
    userId: string,
    operation: string,
    token: FinancialIdempotencyToken,
    transaction: DatabaseTransactionContext,
  ): Promise<T | null> {
    const existing = await this.repository.findRecord(userId, operation, token.keyHash, transaction);
    if (existing) {
      this.assertSameRequest(operation, token.requestHash, existing.requestHash);
      if (existing.response === null) {
        throw new ApiException(409, {
          code: 'IDEMPOTENCY_OPERATION_IN_PROGRESS',
          message: 'The financial operation for this Idempotency-Key is still in progress.',
          details: { operation },
        });
      }
      return existing.response as T;
    }
    await this.repository.createClaim(userId, operation, token.keyHash, token.requestHash, transaction);
    return null;
  }

  async complete(
    userId: string,
    operation: string,
    token: FinancialIdempotencyToken,
    response: unknown,
    transaction: DatabaseTransactionContext,
  ): Promise<void> {
    await this.repository.completeClaim(userId, operation, token.keyHash, response, transaction);
  }

  private assertSameRequest(operation: string, expected: string, stored: string | null): void {
    // NULL is accepted only for records created before the API implementation. New records always store a fingerprint.
    if (stored !== null && stored !== expected) {
      throw new ApiException(409, {
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'This Idempotency-Key was already used for a different request.',
        details: { operation },
      });
    }
  }

  private hashRequestIntent(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(this.canonicalize(value)), 'utf8').digest('hex');
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.canonicalize(entry));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, entry]) => entry !== undefined)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, this.canonicalize(entry)]),
      );
    }
    return value;
  }
}
