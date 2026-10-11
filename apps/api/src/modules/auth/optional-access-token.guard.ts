import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ApiException } from '../../common/http/api-exception.js';
import { AUTH_MODULE_API, type AuthModuleApi } from './public/module-api.js';
import type { AuthenticatedRequest } from './access-token.guard.js';

/**
 * Accepts anonymous requests when no Authorization header is present, while still
 * authenticating a supplied bearer token and rejecting malformed/invalid tokens.
 * This is intended for public endpoints that can use identity when available.
 */
@Injectable()
export class OptionalAccessTokenGuard implements CanActivate {
  constructor(@Inject(AUTH_MODULE_API) private readonly auth: AuthModuleApi) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header('authorization');
    if (!header) return true;

    const [scheme, token, ...extra] = header.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra.length > 0) {
      throw new ApiException(401, {
        code: 'INVALID_BEARER_TOKEN',
        message: 'The supplied Bearer access token is malformed.',
      });
    }

    request.auth = await this.auth.authenticateAccessToken(token);
    return true;
  }
}
