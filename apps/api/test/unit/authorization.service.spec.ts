import { AuthorizationService } from '../../src/common/authorization/authorization.service.js';
import { ApiException } from '../../src/common/http/api-exception.js';

const buyer = {
  userId: '10000000-0000-4000-8000-000000000001',
  sessionId: '10000000-0000-4000-8000-000000000002',
  email: 'buyer@example.invalid',
  name: 'Buyer',
  role: 'BUYER' as const,
};
const admin = { ...buyer, userId: '10000000-0000-4000-8000-000000000003', role: 'ADMIN' as const };

function expectApiException(action: () => void, status: number, code: string): void {
  try {
    action();
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiException);
    const api = error as ApiException;
    expect(api.getStatus()).toBe(status);
    expect(api.getResponse()).toMatchObject({ code });
  }
}

describe('AuthorizationService', () => {
  const authorization = new AuthorizationService();

  it('enforces role allowlists', () => {
    expect(() => authorization.requireRole(buyer, ['BUYER'])).not.toThrow();
    expectApiException(() => authorization.requireRole(buyer, ['SELLER']), 403, 'ROLE_FORBIDDEN');
  });

  it('enforces ownership and supports deliberate concealment', () => {
    expect(() => authorization.requireOwnership(buyer, buyer.userId)).not.toThrow();
    expectApiException(
      () => authorization.requireOwnership(buyer, admin.userId, { conceal: true, resourceCode: 'ORDER_NOT_FOUND' }),
      404,
      'ORDER_NOT_FOUND',
    );
  });

  it('allows explicit admin ownership override only when requested', () => {
    expect(() => authorization.requireOwnership(admin, buyer.userId, { allowAdmin: true })).not.toThrow();
    expectApiException(() => authorization.requireOwnership(admin, buyer.userId), 403, 'RESOURCE_OWNERSHIP_REQUIRED');
  });

  it('keeps domain policy denials distinct from RBAC', () => {
    expect(() => authorization.requirePolicy(true, { code: 'UNUSED', message: 'unused' })).not.toThrow();
    expectApiException(
      () => authorization.requirePolicy(false, { status: 409, code: 'POLICY_BLOCKED', message: 'Blocked by policy.' }),
      409,
      'POLICY_BLOCKED',
    );
  });
});
