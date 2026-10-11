import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest, AuthRole } from '../../modules/auth/public/index.js';
import { ApiException } from '../http/api-exception.js';
import { REQUIRED_ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AuthRole[]>(REQUIRED_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) {
      throw new ApiException(401, {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication must run before role authorization.',
      });
    }
    if (!required.includes(request.auth.role)) {
      throw new ApiException(403, {
        code: 'ROLE_FORBIDDEN',
        message: 'Your role is not permitted to perform this action.',
      });
    }
    return true;
  }
}
