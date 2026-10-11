# ADR-018 — Order state-machine hardening

Status: Accepted for this decision

## Context

The blueprint locks command-style order state changes and explicitly forbids arbitrary client status PATCHes. It also permits eligible buyer cancellation before successful payment with restoration of reserved inventory.

## Decision

1. Introduce Buyer order-list and participant/Admin order-detail endpoints.
2. Implement `POST /orders/:id/cancel` as a serializable command transaction.
3. Centralize implemented order transitions in `order-state-machine.ts` and return `409 INVALID_STATE_TRANSITION` for illegal transitions.
4. Lock the Order row before cancellation.
5. Restore reserved inventory through CatalogModule's public seam in the same transaction.
6. Treat an externally initialized provider-pending payment as temporarily ineligible for cancellation because no provider cancellation operation is defined by the blueprint.
7. Make payment initiation lock the same Order row through the existing transactional OrdersModule payment context, serializing payment initialization with cancellation.
8. Keep shipment, delivery confirmation, dispute-opening, and processing transitions owned by their dedicated module boundaries rather than folding them into this state-machine decision.

## Consequences

- The browser cannot declare authoritative order state.
- Duplicate cancellation cannot restore inventory twice.
- Order cancellation cannot race provider initialization without serialization.
- No new database table, enum, or migration is introduced.
