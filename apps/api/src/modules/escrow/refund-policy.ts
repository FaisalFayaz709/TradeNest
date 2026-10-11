/** Pure financial boundary rules. Replay is read-only after a crash. */
export function refundReconcileOnly(previousStatus: string, previousAttempts: number): boolean {
  return previousStatus !== 'READY' || previousAttempts > 0;
}
export function refundMayFinalize(escrowStatus: string, operationStatus: string): boolean {
  return ['HELD', 'UNDER_REVIEW'].includes(escrowStatus) && operationStatus === 'IN_FLIGHT';
}
export function refundEligibleToDispatch(operationStatus: string, leaseExpired: boolean, retryDue: boolean): boolean {
  return operationStatus === 'READY' ||
    (operationStatus === 'IN_FLIGHT' && leaseExpired) ||
    (operationStatus === 'PROVIDER_PENDING' && retryDue) ||
    (operationStatus === 'NEEDS_REVIEW' && retryDue); // read-only provider lookup, no new refund creation
}
