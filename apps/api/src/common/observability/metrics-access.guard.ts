import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { parseApiEnvironment } from '@tradenest/config';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ApiException } from '../http/api-exception.js';

@Injectable()
export class MetricsAccessGuard implements CanActivate {
  private readonly token = parseApiEnvironment(process.env).OBSERVABILITY_METRICS_TOKEN;

  canActivate(context: ExecutionContext): boolean {
    const token = this.token;
    if (!token) {
      throw new ApiException(404, {
        code: 'OBSERVABILITY_METRICS_DISABLED',
        message: 'Observability metrics are not enabled for this deployment.',
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    const candidate = this.bearerToken(request.header('authorization'));
    if (!candidate || !this.matches(candidate, token)) {
      throw new ApiException(401, {
        code: 'OBSERVABILITY_AUTH_REQUIRED',
        message: 'Valid observability credentials are required.',
      });
    }
    return true;
  }

  private bearerToken(header: string | undefined): string | undefined {
    if (!header) return undefined;
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    return match?.[1]?.trim() || undefined;
  }

  private matches(candidate: string, expected: string): boolean {
    const candidateBuffer = Buffer.from(candidate, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
  }
}
