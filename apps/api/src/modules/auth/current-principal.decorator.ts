import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './access-token.guard.js';
import type { AuthPrincipal } from './public/module-api.js';

export const CurrentPrincipal = createParamDecorator((_data: unknown, context: ExecutionContext): AuthPrincipal => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.auth) throw new Error('CurrentPrincipal used without AccessTokenGuard.');
  return request.auth;
});
