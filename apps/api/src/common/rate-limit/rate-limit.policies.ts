export type RateLimitKeyStrategy =
  | 'IP'
  | 'IDENTITY_EMAIL'
  | 'PRINCIPAL'
  | 'PRINCIPAL_OR_IP';

export type RateLimitPolicyName =
  | 'AUTH_REGISTER_IP'
  | 'AUTH_LOGIN_IP'
  | 'AUTH_LOGIN_IDENTITY'
  | 'AUTH_REFRESH_IP'
  | 'AUTH_CHANGE_PASSWORD_PRINCIPAL'
  | 'BEHAVIOR_EVENT_PRINCIPAL_OR_IP'
  | 'AI_PERSONALIZED_PRINCIPAL'
  | 'AI_SIMILAR_IP'
  | 'AI_PRICING_PRINCIPAL'
  | 'PAYMENT_CREATE_PRINCIPAL'
  | 'CHECKOUT_PRINCIPAL'
  | 'ADMIN_SENSITIVE_PRINCIPAL'
  | 'PAYMENT_WEBHOOK_INVALID_SIGNATURE_IP';

export interface RateLimitPolicy {
  name: RateLimitPolicyName;
  limit: number;
  windowMs: number;
  keyStrategy: RateLimitKeyStrategy;
}

const minute = 60_000;

/**
 * Exact limits are intentionally an implementation decision (ADR-033): the
 * blueprint requires rate limiting but does not lock numeric thresholds.
 */
export const RATE_LIMIT_POLICIES: Readonly<Record<RateLimitPolicyName, RateLimitPolicy>> = {
  AUTH_REGISTER_IP: { name: 'AUTH_REGISTER_IP', limit: 5, windowMs: 15 * minute, keyStrategy: 'IP' },
  AUTH_LOGIN_IP: { name: 'AUTH_LOGIN_IP', limit: 20, windowMs: 5 * minute, keyStrategy: 'IP' },
  AUTH_LOGIN_IDENTITY: { name: 'AUTH_LOGIN_IDENTITY', limit: 8, windowMs: 5 * minute, keyStrategy: 'IDENTITY_EMAIL' },
  AUTH_REFRESH_IP: { name: 'AUTH_REFRESH_IP', limit: 30, windowMs: 5 * minute, keyStrategy: 'IP' },
  AUTH_CHANGE_PASSWORD_PRINCIPAL: { name: 'AUTH_CHANGE_PASSWORD_PRINCIPAL', limit: 5, windowMs: 15 * minute, keyStrategy: 'PRINCIPAL' },
  BEHAVIOR_EVENT_PRINCIPAL_OR_IP: { name: 'BEHAVIOR_EVENT_PRINCIPAL_OR_IP', limit: 120, windowMs: minute, keyStrategy: 'PRINCIPAL_OR_IP' },
  AI_PERSONALIZED_PRINCIPAL: { name: 'AI_PERSONALIZED_PRINCIPAL', limit: 30, windowMs: minute, keyStrategy: 'PRINCIPAL' },
  AI_SIMILAR_IP: { name: 'AI_SIMILAR_IP', limit: 60, windowMs: minute, keyStrategy: 'IP' },
  AI_PRICING_PRINCIPAL: { name: 'AI_PRICING_PRINCIPAL', limit: 20, windowMs: minute, keyStrategy: 'PRINCIPAL' },
  PAYMENT_CREATE_PRINCIPAL: { name: 'PAYMENT_CREATE_PRINCIPAL', limit: 15, windowMs: 5 * minute, keyStrategy: 'PRINCIPAL' },
  CHECKOUT_PRINCIPAL: { name: 'CHECKOUT_PRINCIPAL', limit: 10, windowMs: 5 * minute, keyStrategy: 'PRINCIPAL' },
  ADMIN_SENSITIVE_PRINCIPAL: { name: 'ADMIN_SENSITIVE_PRINCIPAL', limit: 20, windowMs: 5 * minute, keyStrategy: 'PRINCIPAL' },
  PAYMENT_WEBHOOK_INVALID_SIGNATURE_IP: { name: 'PAYMENT_WEBHOOK_INVALID_SIGNATURE_IP', limit: 30, windowMs: minute, keyStrategy: 'IP' },
};
