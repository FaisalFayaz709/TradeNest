import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ApiException } from '../../common/http/api-exception.js';
import { AUTH_MODULE_API, type AuthModuleApi } from './public/module-api.js';
import type { AuthPrincipal } from './public/module-api.js';

export interface AuthenticatedRequest extends Request {
  auth?: AuthPrincipal;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(@Inject(AUTH_MODULE_API) private readonly auth: AuthModuleApi) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header('authorization');
    if (!header) throw this.missingBearer();

    const [scheme, token, ...extra] = header.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra.length > 0) throw this.missingBearer();

    request.auth = await this.auth.authenticateAccessToken(token);
    return true;
  }

  private missingBearer(): ApiException {
    return new ApiException(401, {
      code: 'BEARER_TOKEN_REQUIRED',
      message: 'A valid Bearer access token is required.',
    });
  }
}
