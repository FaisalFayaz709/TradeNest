import type { Dispute } from '@tradenest/contracts/disputes';
import type { DatabaseTransactionContext } from '../../../database/database-transaction.service.js';

/** Public inter-module contract for DisputesModule. */
export interface DisputesModuleApi {
  adminListDisputes(page: number, limit: number): Promise<{ rows: Dispute[]; total: number; open: number }>;
  hasActiveDispute(orderId: string, transaction?: DatabaseTransactionContext): Promise<boolean>;
  completeRefundAfterProvider(disputeId: string, actorId: string, transaction: DatabaseTransactionContext): Promise<void>;
}

export const DISPUTES_MODULE_API = Symbol('DISPUTES_MODULE_API');
