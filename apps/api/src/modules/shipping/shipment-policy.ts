/** Pure fulfillment decision helpers; financial state remains owned by NestJS. */
export function shipmentReplayMatches(
  prior: { carrier: string | null; trackingCode: string | null },
  requested: { carrier: string; trackingCode: string },
): boolean {
  return prior.carrier === requested.carrier && prior.trackingCode === requested.trackingCode;
}

export function mayCreateShipment(orderStatus: string, escrowStatus: string | null): boolean {
  return (orderStatus === 'PAID' || orderStatus === 'PROCESSING') && escrowStatus === 'HELD';
}

export function mayConfirmDelivery(
  orderStatus: string,
  shipmentStatus: string | null,
  escrowStatus: string | null,
  hasActiveDispute: boolean,
): boolean {
  return orderStatus === 'SHIPPED' && shipmentStatus === 'SHIPPED' &&
    escrowStatus === 'SELLER_SHIPPED' && !hasActiveDispute;
}
