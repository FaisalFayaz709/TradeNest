import { NOTIFICATIONS_MODULE_API, type NotificationsModuleApi } from '../notifications/public/module-api.js';
import { Inject, Injectable } from '@nestjs/common';
import { FinancialIdempotencyKeySchema } from '@tradenest/contracts/common';
import {
  AddDisputeEvidenceSchema,
  AddDisputeMessageSchema,
  DisputeEvidenceSchema,
  DisputeMessageSchema,
  DisputeSchema,
  OpenDisputeSchema,
  ResolveDisputeSchema,
  type AddDisputeEvidenceInput,
  type AddDisputeMessageInput,
  type Dispute,
  type DisputeEvidence,
  type DisputeMessage,
  type OpenDisputeInput,
  type ResolveDisputeInput,
} from '@tradenest/contracts/disputes';
import { AuditService } from '../../common/audit/index.js';
import { StorageService, type UploadRequest } from '../../common/storage/index.js';
import { AuthorizationService } from '../../common/authorization/index.js';
import { ApiException } from '../../common/http/api-exception.js';
import { FinancialIdempotencyService } from '../../common/idempotency/index.js';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { DatabaseTransactionService } from '../../database/database-transaction.service.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { ESCROW_MODULE_API, type EscrowModuleApi } from '../escrow/public/module-api.js';
import { ORDERS_MODULE_API, type OrdersModuleApi } from '../orders/public/module-api.js';
import type { DisputesModuleApi } from './public/module-api.js';
import { DisputesRepository } from './disputes.repository.js';

@Injectable()
export class DisputesService implements DisputesModuleApi {
  constructor(
    private readonly repository: DisputesRepository,
    private readonly storage: StorageService,
    private readonly authorization: AuthorizationService,
    private readonly transactions: DatabaseTransactionService,
    private readonly idempotency: FinancialIdempotencyService,
    private readonly audit: AuditService,
    @Inject(ORDERS_MODULE_API) private readonly orders: OrdersModuleApi,
    @Inject(NOTIFICATIONS_MODULE_API) private readonly notifications: NotificationsModuleApi,
    @Inject(ESCROW_MODULE_API) private readonly escrow: EscrowModuleApi,
  ) {}

  /** Invoked from the escrow reconciler in the same DB transaction as the money ledger. */
  async completeRefundAfterProvider(disputeId: string, actorId: string, transaction: DatabaseTransactionContext): Promise<void> {
    await this.repository.lockById(disputeId, transaction);
    const before = await this.repository.findById(disputeId, transaction);
    if (!before || before.status !== 'OPEN') throw this.invalidTransition('RESOLVED', { disputeId });
    if (!await this.repository.resolve(disputeId, 'REFUND_BUYER', actorId, new Date(), transaction)) {
      throw this.invalidTransition('RESOLVED', { disputeId });
    }
    await this.audit.write({
      actorId, action: 'DISPUTE_RESOLUTION', entityType: 'dispute', entityId: disputeId,
      before: { status: 'OPEN', resolution: null }, after: { status: 'RESOLVED', resolution: 'REFUND_BUYER' },
      metadata: { orderId: before.orderId, cause: 'VERIFIED_PROVIDER_REFUND' }, requestId: null,
    }, transaction);
  }

  hasActiveDispute(orderId: string, transaction?: DatabaseTransactionContext): Promise<boolean> {
    return this.repository.hasOpenForOrder(orderId, transaction);
  }

  async adminListDisputes(page: number, limit: number) {
    const result = await this.repository.listAll(page, limit);
    return { rows: result.rows.map((row) => this.mapDispute(row)), total: result.total, open: result.open };
  }

  async open(principal: AuthPrincipal, orderId: string, raw: OpenDisputeInput): Promise<Dispute> {
    this.authorization.requireRole(principal, ['BUYER']);
    const input = OpenDisputeSchema.parse(raw);
    try {
      return await this.transactions.runSerializable(async (transaction) => {
        const order = await this.orders.disputeContext(orderId, transaction);
        if (!order) throw this.notFound();
        this.authorization.requireOwnership(principal, order.buyerId, {
          conceal: true,
          resourceCode: 'ORDER_NOT_FOUND',
        });
        if (!['PAID', 'PROCESSING', 'SHIPPED'].includes(order.status)) {
          throw this.invalidTransition('DISPUTED', { orderStatus: order.status });
        }
        if (order.sellerIds.length !== 1) {
          throw new ApiException(409, {
            code: 'INVALID_STATE_TRANSITION',
            message: 'The order cannot enter dispute because its seller scope is invalid.',
            details: { orderId, sellerCount: order.sellerIds.length },
          });
        }
        if (await this.repository.findByOrderId(orderId, transaction)) {
          throw new ApiException(409, {
            code: 'DISPUTE_ALREADY_EXISTS',
            message: 'A dispute already exists for this order.',
            details: { orderId },
          });
        }
        const escrow = await this.escrow.shippingContext(orderId, transaction);
        if (!escrow || !['HELD', 'SELLER_SHIPPED'].includes(escrow.status)) {
          throw this.invalidTransition('DISPUTED', { orderId, escrowStatus: escrow?.status ?? null });
        }

        const created = await this.repository.createOpen({
          orderId,
          buyerId: principal.userId,
          sellerId: order.sellerIds[0]!,
          reason: input.reason,
          description: input.description,
        }, transaction);
        await this.orders.markDisputedFromDispute(orderId, transaction);
        await this.escrow.markDisputed(orderId, transaction);
        await this.notifications.record({ key: `DISPUTE_OPENED:${created.id}`, type: 'DISPUTE_OPENED',
          title: 'Order dispute opened', body: 'A dispute was opened. Escrow release is paused pending review.',
          recipients: [created.buyerId, created.sellerId],
        }, transaction);
        return this.mapDispute(created);
      });
    } catch (error) {
      if (this.hasPrismaCode(error, 'P2002')) {
        throw new ApiException(409, {
          code: 'DISPUTE_ALREADY_EXISTS',
          message: 'A dispute already exists for this order.',
          details: { orderId },
        });
      }
      throw error;
    }
  }

  async get(principal: AuthPrincipal, disputeId: string): Promise<Dispute> {
    this.authorization.requireRole(principal, ['BUYER', 'SELLER', 'ADMIN']);
    const row = await this.repository.findById(disputeId);
    if (!row) throw this.notFound();
    this.requireParticipantOrAdmin(principal, row);
    const result = this.mapDispute(row);
    result.evidence = await Promise.all(result.evidence.map(async (item) => ({
      ...item,
      url: item.objectKey.startsWith('disputes/') ? await this.storage.signPrivateEvidence(item.objectKey) : '',
    })));
    return result;
  }

  async listSellerDisputes(principal: AuthPrincipal): Promise<Dispute[]> {
    this.authorization.requireRole(principal, ['SELLER']);
    const rows = await this.repository.listForSeller(principal.userId);
    return rows.map((row) => this.mapDispute(row));
  }

  async addMessage(principal: AuthPrincipal, disputeId: string, raw: AddDisputeMessageInput): Promise<DisputeMessage> {
    this.authorization.requireRole(principal, ['BUYER', 'SELLER', 'ADMIN']);
    const input = AddDisputeMessageSchema.parse(raw);
    return this.transactions.runSerializable(async (transaction) => {
      await this.repository.lockById(disputeId, transaction);
      const dispute = await this.repository.findById(disputeId, transaction);
      if (!dispute) throw this.notFound();
      this.requireParticipantOrAdmin(principal, dispute);
      if (dispute.status !== 'OPEN') throw this.invalidTransition('MESSAGE', { disputeStatus: dispute.status });
      const row = await this.repository.addMessage(disputeId, principal.userId, input.body, transaction);
      return DisputeMessageSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
    });
  }

  async prepareEvidenceUpload(principal: AuthPrincipal, disputeId: string, input: UploadRequest) {
    this.authorization.requireRole(principal, ['BUYER', 'SELLER']);
    const dispute = await this.repository.findById(disputeId);
    if (!dispute) throw this.notFound();
    this.requireParticipantOrAdmin(principal, dispute);
    if (dispute.status !== 'OPEN') throw this.invalidTransition('EVIDENCE', { disputeStatus: dispute.status });
    return this.storage.initiate('disputes', disputeId, principal.userId, input);
  }

  async addEvidence(principal: AuthPrincipal, disputeId: string, raw: AddDisputeEvidenceInput): Promise<DisputeEvidence> {
    this.authorization.requireRole(principal, ['BUYER', 'SELLER']);
    const input = AddDisputeEvidenceSchema.parse(raw);
    // Check file provenance outside DB transaction; verify again within transaction
    // that the dispute remains open before persisting metadata.
    const file = await this.storage.verify('disputes', disputeId, principal.userId, input.objectKey);
    const created = await this.transactions.runSerializable(async (transaction) => {
      await this.repository.lockById(disputeId, transaction);
      const dispute = await this.repository.findById(disputeId, transaction);
      if (!dispute) throw this.notFound();
      const participant = dispute.buyerId === principal.userId || dispute.sellerId === principal.userId;
      this.authorization.requirePolicy(participant, {
        status: 404,
        code: 'DISPUTE_NOT_FOUND',
        message: 'The requested dispute was not found.',
      });
      if (dispute.status !== 'OPEN') throw this.invalidTransition('EVIDENCE', { disputeStatus: dispute.status });
      const row = await this.repository.addEvidence(disputeId, principal.userId, {
        objectKey: input.objectKey, url: 'private:managed-evidence',
        ...(input.fileName !== undefined ? { fileName: input.fileName } : {}), mimeType: file.mimeType,
      }, transaction);
      return DisputeEvidenceSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
    });
    return { ...created, url: await this.storage.signPrivateEvidence(created.objectKey) };
  }

  async resolve(
    principal: AuthPrincipal,
    disputeId: string,
    raw: ResolveDisputeInput,
    rawIdempotencyKey: string | undefined,
    requestId?: string,
  ): Promise<Dispute> {
    this.authorization.requireRole(principal, ['ADMIN']);
    const input = ResolveDisputeSchema.parse(raw);
    const key = this.requireIdempotencyKey(rawIdempotencyKey);
    const operation = 'DISPUTE_RESOLVE';
    const token = this.idempotency.prepare(key, { disputeId, resolution: input.resolution });
    const replay = await this.idempotency.replayOrThrow<unknown>(principal.userId, operation, token);
    if (replay) return DisputeSchema.parse(replay);

    try {
      return await this.transactions.runSerializable(async (transaction) => {
        const transactionReplay = await this.idempotency.claimOrReplay<unknown>(principal.userId, operation, token, transaction);
        if (transactionReplay) return DisputeSchema.parse(transactionReplay);

        await this.repository.lockById(disputeId, transaction);
        const before = await this.repository.findById(disputeId, transaction);
        if (!before) throw this.notFound();
        if (before.status !== 'OPEN') throw this.invalidTransition('RESOLVED', { disputeStatus: before.status });

        const order = await this.orders.disputeContext(before.orderId, transaction);
        if (!order || order.status !== 'DISPUTED') {
          throw this.invalidTransition('RESOLVED', { orderStatus: order?.status ?? null });
        }
        const escrow = await this.escrow.shippingContext(before.orderId, transaction);
        if (!escrow || escrow.status !== 'DISPUTED') {
          throw this.invalidTransition('UNDER_REVIEW', { escrowStatus: escrow?.status ?? null });
        }

        await this.escrow.markUnderReview(before.orderId, transaction);
        if (input.resolution === 'REFUND_BUYER') {
          await this.escrow.resolveDisputeRefund({
            orderId: before.orderId,
            actorId: principal.userId,
            disputeId: disputeId,
            idempotencyKey: key,
            requestId: this.cleanRequestId(requestId),
          }, transaction);
          // Financial outcome is pending. A background reconciler finalizes both
          // escrow and the dispute atomically after verified provider success.
          const response = this.mapDispute(before);
          await this.audit.write({
            actorId: principal.userId, action: 'DISPUTE_REFUND_QUEUED',
            entityType: 'dispute', entityId: disputeId,
            before: { status: before.status }, after: { status: 'OPEN', financialOutcome: 'PENDING' },
            metadata: { orderId: before.orderId }, requestId: this.cleanRequestId(requestId),
          }, transaction);
          await this.idempotency.complete(principal.userId, operation, token, response, transaction);
          return response;
        } else {
          await this.escrow.resolveDisputeRelease({
            orderId: before.orderId,
            actorId: principal.userId,
            idempotencyKey: key,
            requestId: this.cleanRequestId(requestId),
          }, transaction);
          await this.orders.markCompletedFromEscrowRelease(before.orderId, transaction);
        }

        const resolvedAt = new Date();
        if (!await this.repository.resolve(disputeId, input.resolution, principal.userId, resolvedAt, transaction)) {
          throw this.invalidTransition('RESOLVED', { disputeId });
        }
        const after = await this.repository.findById(disputeId, transaction);
        if (!after) throw this.notFound();
        const response = this.mapDispute(after);
        await this.audit.write({
          actorId: principal.userId,
          action: 'DISPUTE_RESOLUTION',
          entityType: 'dispute',
          entityId: disputeId,
          before: {
            status: before.status,
            resolution: before.resolution,
            orderId: before.orderId,
          },
          after: {
            status: after.status,
            resolution: after.resolution,
            resolvedBy: after.resolvedBy,
            resolvedAt: after.resolvedAt?.toISOString() ?? null,
          },
          metadata: { orderId: before.orderId, outcome: input.resolution },
          requestId: this.cleanRequestId(requestId),
        }, transaction);
        await this.notifications.record({ key: `DISPUTE_RESOLVED:${disputeId}`, type: 'DISPUTE_RESOLVED',
          title: 'Dispute resolved', body: 'An administrator resolved the order dispute. View your order for the outcome.',
          recipients: [before.buyerId, before.sellerId],
        }, transaction);
        await this.idempotency.complete(principal.userId, operation, token, response, transaction);
        return response;
      });
    } catch (error) {
      if (this.hasPrismaCode(error, 'P2002')) {
        const concurrentReplay = await this.idempotency.replayOrThrow<unknown>(principal.userId, operation, token);
        if (concurrentReplay) return DisputeSchema.parse(concurrentReplay);
      }
      throw error;
    }
  }

  private requireParticipantOrAdmin(principal: AuthPrincipal, row: { buyerId: string; sellerId: string }): void {
    if (principal.role === 'ADMIN') return;
    const participant = row.buyerId === principal.userId || row.sellerId === principal.userId;
    this.authorization.requirePolicy(participant, {
      status: 404,
      code: 'DISPUTE_NOT_FOUND',
      message: 'The requested dispute was not found.',
    });
  }

  private mapDispute(row: any): Dispute {
    return DisputeSchema.parse({
      id: row.id,
      orderId: row.orderId,
      buyerId: row.buyerId,
      sellerId: row.sellerId,
      reason: row.reason,
      description: row.description,
      status: row.status,
      resolution: row.resolution,
      resolvedBy: row.resolvedBy,
      openedAt: row.openedAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      messages: row.messages.map((message: any) => ({ ...message, createdAt: message.createdAt.toISOString() })),
      evidence: row.evidence.map((item: any) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    });
  }

  private requireIdempotencyKey(value: string | undefined): string {
    const parsed = FinancialIdempotencyKeySchema.safeParse(value);
    if (!parsed.success) {
      throw new ApiException(400, {
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'A valid Idempotency-Key header is required for dispute resolution.',
      });
    }
    return parsed.data;
  }

  private invalidTransition(requested: string, details: Record<string, unknown>): ApiException {
    return new ApiException(409, {
      code: 'INVALID_STATE_TRANSITION',
      message: 'The dispute workflow cannot transition from its current state.',
      details: { requestedStatus: requested, ...details },
    });
  }

  private notFound(): ApiException {
    return new ApiException(404, { code: 'DISPUTE_NOT_FOUND', message: 'The requested dispute was not found.' });
  }

  private cleanRequestId(value: string | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned && cleaned.length <= 128 ? cleaned : null;
  }

  private hasPrismaCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
  }
}
