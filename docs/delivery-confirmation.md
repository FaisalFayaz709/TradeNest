# Buyer Delivery Confirmation

This capability implements `POST /api/v1/orders/:id/confirm-delivery` as a Buyer-owned financial command.

Locked blueprint behavior:

- only the owning Buyer may confirm delivery;
- the Order must be in an eligible shipped state;
- Escrow must be unreleased and awaiting Buyer confirmation;
- an active dispute blocks automatic release;
- valid confirmation completes the Order and releases Escrow transactionally;
- Escrow release is represented by a RELEASE ledger entry;
- financial writes support `Idempotency-Key`;
- the browser cannot directly PATCH Order/Escrow/Shipment state.

## Transaction

The command runs in one serializable PostgreSQL transaction:

1. claim/replay the Buyer financial idempotency key;
2. lock the Order row;
3. verify Buyer ownership and `Order = SHIPPED`;
4. verify there is no `Dispute = OPEN` for the Order;
5. verify `Escrow = SELLER_SHIPPED`;
6. transition `Order: SHIPPED -> DELIVERED`;
7. transition `Shipment: SHIPPED -> DELIVERED` and set `delivered_at`;
8. transition `Escrow: SELLER_SHIPPED -> BUYER_CONFIRMED -> RELEASED`;
9. append exactly one `RELEASE` escrow ledger entry;
10. write the escrow-release audit record;
11. transition `Order: DELIVERED -> COMPLETED` and set `completed_at`;
12. persist the exact idempotent response;
13. commit.

Any failure rolls back all local writes.

## Dispute boundary

This capability introduces only a read-only `DisputesModuleApi.hasActiveDispute(orderId)` seam because the blueprint requires Buyer confirmation to verify the absence of an active dispute. Dispute creation, messaging, evidence, review, and resolution are owned by the dedicated disputes capability.

## Shipping boundary

Shipment status/timestamps are backend-owned. This capability expands the shipment response contract to `SHIPPED | DELIVERED` and makes `deliveredAt` nullable rather than permanently null.

## No schema change

The existing database already has Order, Shipment, Escrow, EscrowTransaction, Dispute, AuditLog and IdempotencyRecord structures needed by this command. This capability adds no Prisma model or migration.
