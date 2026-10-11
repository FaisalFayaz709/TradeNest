import { SetMetadata } from '@nestjs/common';
import type { RateLimitPolicyName } from './rate-limit.policies.js';

export const RATE_LIMIT_METADATA = 'tradenest:rate-limit-policies';

export const RateLimit = (...policies: RateLimitPolicyName[]): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_METADATA, policies);
