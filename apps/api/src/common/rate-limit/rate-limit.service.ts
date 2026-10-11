import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { ApiException } from '../http/api-exception.js';
import { RATE_LIMIT_POLICIES, type RateLimitPolicy, type RateLimitPolicyName } from './rate-limit.policies.js';

interface WindowCounter {
  count: number;
  resetAt: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

type RequestWithAuth = Request & { auth?: { userId?: string } };

@Injectable()
export class RateLimitService {
  private readonly windows = new Map<string, WindowCounter>();
  private readonly maxEntries = 50_000;
  private operationsSincePrune = 0;

  consume(policyName: RateLimitPolicyName, key: string, now = Date.now()): RateLimitDecision {
    const policy = RATE_LIMIT_POLICIES[policyName];
    this.pruneIfNeeded(now);
    const bucketKey = `${policy.name}:${key}`;
    const existing = this.windows.get(bucketKey);

    if (!existing || existing.resetAt <= now) {
      this.ensureCapacity(now);
      const resetAt = now + policy.windowMs;
      this.windows.set(bucketKey, { count: 1, resetAt });
      return this.decision(policy, 1, resetAt, now);
    }

    if (existing.count >= policy.limit) {
      return {
        allowed: false,
        limit: policy.limit,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        resetAt: existing.resetAt,
      };
    }

    existing.count += 1;
    return this.decision(policy, existing.count, existing.resetAt, now);
  }

  keyFor(policyName: RateLimitPolicyName, request: RequestWithAuth): string {
    const policy = RATE_LIMIT_POLICIES[policyName];
    const ip = this.clientIp(request);
    switch (policy.keyStrategy) {
      case 'IP':
        return `ip:${ip}`;
      case 'IDENTITY_EMAIL': {
        const email = typeof request.body === 'object' && request.body !== null && 'email' in request.body
          ? String((request.body as { email?: unknown }).email ?? '').trim().toLowerCase()
          : '';
        return `identity:${createHash('sha256').update(email || '<missing>', 'utf8').digest('hex')}`;
      }
      case 'PRINCIPAL':
        return request.auth?.userId ? `user:${request.auth.userId}` : `ip:${ip}`;
      case 'PRINCIPAL_OR_IP':
        return request.auth?.userId ? `user:${request.auth.userId}` : `ip:${ip}`;
    }
  }

  assertAllowed(policyName: RateLimitPolicyName, key: string): RateLimitDecision {
    const decision = this.consume(policyName, key);
    if (!decision.allowed) throw this.exceeded(policyName, decision);
    return decision;
  }

  exceeded(policyName: RateLimitPolicyName, decision: RateLimitDecision): ApiException {
    return new ApiException(429, {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Retry after the indicated delay.',
      details: {
        policy: policyName,
        retryAfterSeconds: decision.retryAfterSeconds,
      },
    });
  }

  clientIp(request: Pick<Request, 'ip' | 'socket'>): string {
    const value = request.ip || request.socket?.remoteAddress || 'unknown';
    return String(value).trim().slice(0, 128) || 'unknown';
  }

  private decision(policy: RateLimitPolicy, count: number, resetAt: number, now: number): RateLimitDecision {
    return {
      allowed: true,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - count),
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      resetAt,
    };
  }

  private pruneIfNeeded(now: number): void {
    this.operationsSincePrune += 1;
    if (this.operationsSincePrune < 256) return;
    this.operationsSincePrune = 0;
    this.pruneExpired(now);
  }

  private ensureCapacity(now: number): void {
    if (this.windows.size < this.maxEntries) return;
    this.pruneExpired(now);
    if (this.windows.size < this.maxEntries) return;

    let oldestKey: string | undefined;
    let oldestReset = Number.POSITIVE_INFINITY;
    for (const [key, counter] of this.windows) {
      if (counter.resetAt < oldestReset) {
        oldestKey = key;
        oldestReset = counter.resetAt;
      }
    }
    if (oldestKey) this.windows.delete(oldestKey);
  }

  private pruneExpired(now: number): void {
    for (const [key, counter] of this.windows) {
      if (counter.resetAt <= now) this.windows.delete(key);
    }
  }
}
