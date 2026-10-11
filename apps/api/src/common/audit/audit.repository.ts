import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';

export interface AuditWriteInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  requestId?: string | null;
}

@Injectable()
export class AuditRepository {
  async write(input: AuditWriteInput, transaction: DatabaseTransactionContext): Promise<void> {
    await transaction.client.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        ...(input.before !== undefined ? { before: input.before as Prisma.InputJsonValue } : {}),
        ...(input.after !== undefined ? { after: input.after as Prisma.InputJsonValue } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
        requestId: input.requestId ?? null,
      },
    });
  }
}
