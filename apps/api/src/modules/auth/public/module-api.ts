import type { DatabaseTransactionContext } from '../../../database/database-transaction.service.js';

export type AuthRole = 'BUYER' | 'SELLER' | 'ADMIN';

export interface AuthPrincipal {
  userId: string;
  sessionId: string;
  email: string;
  name: string;
  role: AuthRole;
}

/**
 * Explicit public inter-module authentication boundary.
 * Business modules should depend on this seam (or the exported guard/decorator),
 * never on AuthModule internals.
 */
export interface AuthModuleApi {
  authenticateAccessToken(token: string): Promise<AuthPrincipal>;
  isAccountActive(userId: string, transaction?: DatabaseTransactionContext): Promise<boolean>;
}

export const AUTH_MODULE_API = Symbol('AUTH_MODULE_API');
