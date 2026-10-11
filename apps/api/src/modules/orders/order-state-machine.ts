import type { OrderStatus } from '@tradenest/contracts/orders';
import { ApiException } from '../../common/http/api-exception.js';

export function assertOrderTransition(
  currentStatus: OrderStatus,
  requestedStatus: OrderStatus,
  allowedFrom: readonly OrderStatus[],
): void {
  if (currentStatus === requestedStatus) return;
  if (allowedFrom.includes(currentStatus)) return;
  throw invalidOrderTransition(currentStatus, requestedStatus);
}

export function invalidOrderTransition(
  currentStatus: string | null,
  requestedStatus: OrderStatus,
  reason?: string,
): ApiException {
  return new ApiException(409, {
    code: 'INVALID_STATE_TRANSITION',
    message: 'The order cannot transition from its current state.',
    details: { currentStatus, requestedStatus, ...(reason ? { reason } : {}) },
  });
}
