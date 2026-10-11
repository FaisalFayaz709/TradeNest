import { Injectable } from '@nestjs/common';
import { ApiException } from '../http/api-exception.js';
import type { AuthPrincipal, AuthRole } from '../../modules/auth/public/index.js';
import type { OwnershipOptions, PolicyDenial } from './authorization.types.js';

@Injectable()
export class AuthorizationService {
  requireRole(principal: AuthPrincipal, allowed: readonly AuthRole[]): void {
    if (!allowed.includes(principal.role)) {
      throw new ApiException(403, {
        code: 'ROLE_FORBIDDEN',
        message: 'Your role is not permitted to perform this action.',
      });
    }
  }

  requireOwnership(
    principal: AuthPrincipal,
    ownerUserId: string,
    options: OwnershipOptions = {},
  ): void {
    if (principal.userId === ownerUserId) return;
    if (options.allowAdmin === true && principal.role === 'ADMIN') return;

    if (options.conceal === true) {
      throw new ApiException(404, {
        code: options.resourceCode ?? 'RESOURCE_NOT_FOUND',
        message: 'The requested resource was not found.',
      });
    }

    throw new ApiException(403, {
      code: 'RESOURCE_OWNERSHIP_REQUIRED',
      message: 'You do not own the requested resource.',
    });
  }

  requirePolicy(allowed: boolean, denial: PolicyDenial): void {
    if (allowed) return;
    throw new ApiException(denial.status ?? 403, {
      code: denial.code,
      message: denial.message,
    });
  }
}
