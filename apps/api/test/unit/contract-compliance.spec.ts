import { RATE_LIMIT_POLICIES } from '../../src/common/rate-limit/rate-limit.policies.js';

describe('the implementation contract compliance', () => {
  it('rate-limits checkout and admin-sensitive commands', () => {
    expect(RATE_LIMIT_POLICIES.CHECKOUT_PRINCIPAL.keyStrategy).toBe('PRINCIPAL');
    expect(RATE_LIMIT_POLICIES.ADMIN_SENSITIVE_PRINCIPAL.keyStrategy).toBe('PRINCIPAL');
    expect(RATE_LIMIT_POLICIES.CHECKOUT_PRINCIPAL.limit).toBeGreaterThan(0);
    expect(RATE_LIMIT_POLICIES.ADMIN_SENSITIVE_PRINCIPAL.limit).toBeGreaterThan(0);
  });
});
