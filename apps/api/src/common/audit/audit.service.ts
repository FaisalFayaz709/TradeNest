import { Injectable } from '@nestjs/common';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { REQUEST_ID_LIMIT } from '../http/request-id.js';
import { AuditRepository, type AuditWriteInput } from './audit.repository.js';

const ACTION_PATTERN = /^[A-Z0-9][A-Z0-9_:-]{0,127}$/;
const ENTITY_TYPE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/;
const SENSITIVE_KEY_PATTERN = /(?:password|password_hash|passwordhash|access_token|accesstoken|refresh_token|refreshtoken|authorization|cookie|secret|api_key|apikey|client_secret|clientsecret|raw_body|rawbody|signature)/i;
const REDACTED = '[REDACTED]';
const MAX_AUDIT_DEPTH = 10;

@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  async write(input: AuditWriteInput, transaction: DatabaseTransactionContext): Promise<void> {
    const normalized = this.normalize(input);
    await this.repository.write(normalized, transaction);
  }

  private normalize(input: AuditWriteInput): AuditWriteInput {
    if (!ACTION_PATTERN.test(input.action)) {
      throw new Error(`Invalid audit action: ${input.action}`);
    }
    if (!ENTITY_TYPE_PATTERN.test(input.entityType)) {
      throw new Error(`Invalid audit entity type: ${input.entityType}`);
    }

    return {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: input.before === undefined ? undefined : this.redact(input.before, 0),
      after: input.after === undefined ? undefined : this.redact(input.after, 0),
      metadata: input.metadata === undefined ? undefined : this.redact(input.metadata, 0),
      requestId: this.requestId(input.requestId),
    };
  }

  private requestId(value: string | null | undefined): string | null {
    const cleaned = value?.trim();
    if (!cleaned) return null;
    return cleaned.slice(0, REQUEST_ID_LIMIT);
  }

  private redact(value: unknown, depth: number): unknown {
    if (depth > MAX_AUDIT_DEPTH) return '[TRUNCATED]';
    if (value === null || typeof value !== 'object') return value;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((entry) => this.redact(entry, depth + 1));

    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : this.redact(entry, depth + 1);
    }
    return output;
  }
}
