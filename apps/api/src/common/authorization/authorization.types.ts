import type { AuthPrincipal, AuthRole } from '../../modules/auth/public/index.js';

export type AuthorizationPrincipal = AuthPrincipal;
export type AuthorizationRole = AuthRole;

export interface PolicyDenial {
  status?: 403 | 404;
  code: string;
  message: string;
}

export interface OwnershipOptions {
  /** Explicitly opt in. Ownership never grants ADMIN bypass by default. */
  allowAdmin?: boolean;
  /** Conceal resource existence when ownership fails. */
  conceal?: boolean;
  resourceCode?: string;
}
