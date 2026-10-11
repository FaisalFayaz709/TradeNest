# ADR-020: Buyer Delivery Confirmation and Automatic Escrow Release

## Status
Accepted for this decision.

## Context
The TradeNest blueprint requires Buyer delivery confirmation to verify Buyer ownership, eligible Order state, unreleased Escrow and absence of an active dispute. A valid confirmation completes the Order and releases Escrow through a transaction and ledger entry.

## Decision
`POST /orders/:id/confirm-delivery` is implemented as an idempotent Buyer financial command coordinated by `OrdersService`.

The command locks the Order row and uses explicit public module seams:

- `DisputesModuleApi` for the active-dispute policy check;
- `ShippingModuleApi` for Shipment-owned delivered state;
- `EscrowModuleApi` for Buyer-confirmation + RELEASE ledger/audit behavior;
- `OrdersRepository` for Order-owned transitions.

The Order passes through `SHIPPED -> DELIVERED -> COMPLETED` inside the same transaction. Escrow passes through `SELLER_SHIPPED -> BUYER_CONFIRMED -> RELEASED` inside the same transaction.

## Idempotency
Because confirmation releases funds, `Idempotency-Key` is mandatory. The existing durable financial-idempotency service stores the exact response and detects key reuse with a different request fingerprint.

## Active dispute
Only a read-only dispute seam is introduced in this decision. No dispute command is implemented early.

## Consequences
- no direct Controller -> Prisma access;
- no cross-module table mutation by Orders;
- no arbitrary Order/Escrow status PATCH;
- no automatic release while an OPEN dispute exists;
- one RELEASE ledger entry per successful confirmation transaction;
- Shipment delivered timestamp is synchronized with Buyer confirmation;
- no new schema/migration is required.
