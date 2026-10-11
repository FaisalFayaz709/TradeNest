import type { Escrow } from '@tradenest/contracts/escrow';
import type { DatabaseTransactionContext } from '../../../database/database-transaction.service.js';

export type EscrowLifecycleStatus =
  | 'PENDING'
  | 'HELD'
  | 'SELLER_SHIPPED'
  | 'BUYER_CONFIRMED'
  | 'RELEASED'
  | 'DISPUTED'
  | 'UNDER_REVIEW'
  | 'REFUNDED';

export interface EscrowShippingContext {
  id: string;
  orderId: string;
  status: EscrowLifecycleStatus;
}

export interface HoldEscrowInput {
  orderId: string;
  paymentId: string;
  amount: string;
  reference: string;
  heldAt: Date;
}

export interface HeldEscrow {
  id: string;
  orderId: string;
  paymentId: string;
  status: 'HELD';
  amount: string;
}


export interface ResolveDisputeFinancialInput {
  orderId: string;
  actorId: string;
  idempotencyKey: string;
  requestId?: string | null;
  disputeId?: string | null;
}

export interface BuyerConfirmationReleaseInput {
  orderId: string;
  buyerId: string;
  releasedAt: Date;
  reference: string;
  requestId?: string | null;
}

export interface EscrowModuleApi {
  adminListEscrows(page: number, limit: number): Promise<{ rows: Escrow[]; total: number }>;
  shippingContext(orderId: string, transaction?: DatabaseTransactionContext): Promise<EscrowShippingContext | null>;
  holdVerifiedPayment(input: HoldEscrowInput, transaction: DatabaseTransactionContext): Promise<HeldEscrow>;
  markSellerShipped(orderId: string, transaction: DatabaseTransactionContext): Promise<void>;
  markBuyerConfirmed(orderId: string, transaction: DatabaseTransactionContext): Promise<void>;
  confirmBuyerAndRelease(input: BuyerConfirmationReleaseInput, transaction: DatabaseTransactionContext): Promise<void>;
  markDisputed(orderId: string, transaction: DatabaseTransactionContext): Promise<void>;
  markUnderReview(orderId: string, transaction: DatabaseTransactionContext): Promise<void>;
  resolveDisputeRelease(input: ResolveDisputeFinancialInput, transaction: DatabaseTransactionContext): Promise<void>;
  resolveDisputeRefund(input: ResolveDisputeFinancialInput, transaction: DatabaseTransactionContext): Promise<void>;
}

export const ESCROW_MODULE_API = Symbol('ESCROW_MODULE_API');
