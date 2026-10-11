import { ApiException } from '../../src/common/http/api-exception.js';
import { assertOrderTransition, invalidOrderTransition } from '../../src/modules/orders/order-state-machine.js';

describe('Order state machine', () => {
  it('accepts an explicitly allowed command transition', () => {
    expect(() => assertOrderTransition('PENDING_PAYMENT', 'PAID', ['PENDING_PAYMENT'])).not.toThrow();
    expect(() => assertOrderTransition('SHIPPED', 'DELIVERED', ['SHIPPED'])).not.toThrow();
  });

  it('is idempotent for an already-completed transition target', () => {
    expect(() => assertOrderTransition('COMPLETED', 'COMPLETED', [])).not.toThrow();
  });

  it('rejects arbitrary/illegal transitions with the locked 409 code', () => {
    expect(() => assertOrderTransition('PAID', 'CANCELLED', ['PENDING_PAYMENT'])).toThrow(ApiException);
    try {
      assertOrderTransition('PAID', 'CANCELLED', ['PENDING_PAYMENT']);
    } catch (error) {
      const api = error as ApiException;
      expect(api.getStatus()).toBe(409);
      expect(api.getResponse()).toMatchObject({
        code: 'INVALID_STATE_TRANSITION',
        details: { currentStatus: 'PAID', requestedStatus: 'CANCELLED' },
      });
    }
  });

  it('builds a consistent invalid-transition error payload', () => {
    const error = invalidOrderTransition('DISPUTED', 'COMPLETED', 'resolution required');
    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      details: { currentStatus: 'DISPUTED', requestedStatus: 'COMPLETED', reason: 'resolution required' },
    });
  });
});
