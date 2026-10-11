import type { AuthPrincipal } from '../../auth/public/module-api.js';
import type { DatabaseTransactionContext } from '../../../database/database-transaction.service.js';

export interface ActiveSeller {
  userId: string;
  storeName: string;
  slug: string;
  status: 'ACTIVE';
}

export interface SellerIdentity {
  userId: string;
  storeName: string;
  slug: string;
  status: string;
}

/**
 * Explicit public inter-module seller policy boundary.
 *
 * Transactional business commands use requireActiveSeller. Read-only seller
 * experiences such as analytics can require an onboarded seller identity
 * without silently treating ACTIVE as an analytics-visibility requirement.
 */
export interface AdminSellerSummary {
  userId: string;
  storeName: string;
  slug: string;
  status: string;
  rating: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SellerModuleApi {
  adminListSellers(page: number, limit: number): Promise<{ rows: AdminSellerSummary[]; total: number }>;
  adminSuspendSeller(actor: AuthPrincipal, sellerId: string, reason: string): Promise<AdminSellerSummary>;
  adminReactivateSeller(actor: AuthPrincipal, sellerId: string, reason: string): Promise<AdminSellerSummary>;
  requireSellerProfile(userId: string, transaction?: DatabaseTransactionContext): Promise<SellerIdentity>;
  requireActiveSeller(userId: string, transaction?: DatabaseTransactionContext): Promise<ActiveSeller>;
}

export const SELLER_MODULE_API = Symbol('SELLER_MODULE_API');
