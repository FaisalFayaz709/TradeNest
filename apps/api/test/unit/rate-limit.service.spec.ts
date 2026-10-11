import { RateLimitService } from '../../src/common/rate-limit/index.js';

describe('RateLimitService', () => {
  it('enforces a fixed window and exposes retry timing', () => {
    const service = new RateLimitService();
    const start = 1_000_000;
    for (let i = 0; i < 5; i += 1) {
      expect(service.consume('AUTH_REGISTER_IP', 'ip:203.0.113.10', start).allowed).toBe(true);
    }
    const denied = service.consume('AUTH_REGISTER_IP', 'ip:203.0.113.10', start);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterSeconds).toBe(900);

    const reset = service.consume('AUTH_REGISTER_IP', 'ip:203.0.113.10', start + 900_001);
    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(4);
  });

  it('hashes login identity keys instead of retaining raw email addresses', () => {
    const service = new RateLimitService();
    const request = {
      ip: '203.0.113.20',
      socket: { remoteAddress: '203.0.113.20' },
      body: { email: ' Buyer@Example.com ' },
    } as never;

    const key = service.keyFor('AUTH_LOGIN_IDENTITY', request);
    expect(key).toMatch(/^identity:[0-9a-f]{64}$/);
    expect(key).not.toContain('buyer@example.com');
  });

  it('uses authenticated user identity for principal-or-IP policies', () => {
    const service = new RateLimitService();
    const authenticated = {
      ip: '203.0.113.30',
      socket: { remoteAddress: '203.0.113.30' },
      auth: { userId: 'user-123' },
    } as never;
    const anonymous = {
      ip: '203.0.113.31',
      socket: { remoteAddress: '203.0.113.31' },
    } as never;

    expect(service.keyFor('BEHAVIOR_EVENT_PRINCIPAL_OR_IP', authenticated)).toBe('user:user-123');
    expect(service.keyFor('BEHAVIOR_EVENT_PRINCIPAL_OR_IP', anonymous)).toBe('ip:203.0.113.31');
  });

  it('returns a structured 429 exception when a bucket is exhausted', () => {
    const service = new RateLimitService();
    for (let i = 0; i < 30; i += 1) {
      service.consume('PAYMENT_WEBHOOK_INVALID_SIGNATURE_IP', 'provider:sandbox:ip:203.0.113.40', 10_000);
    }
    const denied = service.consume('PAYMENT_WEBHOOK_INVALID_SIGNATURE_IP', 'provider:sandbox:ip:203.0.113.40', 10_000);
    const exception = service.exceeded('PAYMENT_WEBHOOK_INVALID_SIGNATURE_IP', denied);
    expect(exception.getStatus()).toBe(429);
    expect(exception.getResponse()).toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      details: { policy: 'PAYMENT_WEBHOOK_INVALID_SIGNATURE_IP' },
    });
  });
});
