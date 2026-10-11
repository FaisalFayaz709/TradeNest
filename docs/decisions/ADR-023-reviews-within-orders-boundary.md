# ADR-023 — Reviews live within OrdersModule

## Status

Accepted for this decision.

## Context

The blueprint exposes review endpoints and a `reviews` table but the locked modular-monolith module inventory does not define a standalone Reviews module. Review creation is purchase-derived: only a Buyer with a completed purchased OrderItem may review that product.

## Decision

Implement review controller/service/repository surfaces inside `OrdersModule`.

- `ReviewsRepository` persists Review rows only.
- `OrdersRepository` supplies the completed-purchase context.
- `productId` is derived from the immutable OrderItem snapshot.
- Public responses omit `buyerId` and `orderItemId`.
- No new NestJS marketplace module, Prisma model, or migration is introduced.

## Consequences

This keeps the module inventory architecture-locked and avoids a Catalog↔Orders circular dependency. If a future blueprint revision explicitly establishes Reviews as a first-class module, that would require a later architecture ADR rather than silently changing the current boundary.
