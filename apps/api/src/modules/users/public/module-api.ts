import type { AuthPrincipal } from '../../auth/public/module-api.js';
import type { DatabaseTransactionContext } from '../../../database/database-transaction.service.js';

export interface CheckoutAddressSnapshot {
  addressId: string;
  recipient: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  phone: string | null;
}

/** Explicit public Users-module seam. */
export interface AdminUserSummary {
  id: string;
  email: string;
  name: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UsersModuleApi {
  adminListUsers(page: number, limit: number): Promise<{ rows: AdminUserSummary[]; total: number }>;
  adminSuspendUser(actor: AuthPrincipal, targetId: string, reason: string): Promise<AdminUserSummary>;
  adminReactivateUser(actor: AuthPrincipal, targetId: string, reason: string): Promise<AdminUserSummary>;
  requireOwnedCheckoutAddress(
    userId: string,
    addressId: string,
    transaction: DatabaseTransactionContext,
  ): Promise<CheckoutAddressSnapshot>;
}

export const USERS_MODULE_API = Symbol('USERS_MODULE_API');
