import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RATE_LIMIT_METADATA } from './rate-limit.decorator.js';
import type { RateLimitPolicyName } from './rate-limit.policies.js';
import { RateLimitService } from './rate-limit.service.js';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimits: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const policies = this.reflector.getAllAndOverride<RateLimitPolicyName[]>(RATE_LIMIT_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];
    if (policies.length === 0) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { auth?: { userId?: string } }>();
    const response = http.getResponse<Response>();

    for (const policy of policies) {
      const key = this.rateLimits.keyFor(policy, request);
      const decision = this.rateLimits.consume(policy, key);
      if (!decision.allowed) {
        response.setHeader('Retry-After', String(decision.retryAfterSeconds));
        response.setHeader('X-RateLimit-Policy', policy);
        throw this.rateLimits.exceeded(policy, decision);
      }
    }
    return true;
  }
}
