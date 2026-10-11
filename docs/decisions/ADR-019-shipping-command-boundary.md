# ADR-019: Shipping command boundary

## Status
Accepted for this decision.

## Context
The TradeNest blueprint requires a Seller shipment command for an eligible paid/processing order with escrow held. Shipping must move Order to `SHIPPED` and Escrow to `SELLER_SHIPPED`. The blueprint does not choose a carrier integration or define a complete shipping-status vocabulary.

## Decision
- Shipping remains owned by `ShippingModule`.
- The request accepts only validated `carrier` and `trackingCode` strings.
- The server owns shipment status/timestamps.
- `ShippingService` coordinates Orders and Escrow only through their public module APIs.
- Shipment creation and both state transitions share one serializable database transaction.
- The Order row is the serialization lock for duplicate same-order shipment creation; no new database uniqueness rule is invented in this document.
- Existing shipment creation retries return the existing shipment and do not repeat Order/Escrow transitions.

## Consequences
No carrier/provider integration is locked by this ADR. Delivery confirmation is a separate Buyer-owned command boundary.
