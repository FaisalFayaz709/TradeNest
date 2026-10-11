# ADR-010 — Inventory concurrency and ownership

**Status:** Accepted for this decision
**Classification:** ALLOWED IMPLEMENTATION DECISION constrained by locked blueprint rules

## Context

The TradeNest blueprint locks an owned seller inventory endpoint, separate available/reserved quantities, non-negative database integrity, and concurrency-safe reservation during checkout. It does not specify the exact PATCH request body or internal inventory service method signatures.

## Decision

1. `PATCH /products/:id/inventory` accepts only `availableQuantity`.
2. Sellers cannot directly set `reservedQuantity`.
3. Seller inventory updates require `SELLER` plus product ownership.
4. Reservation uses one conditional database update requiring `availableQuantity >= quantity`, then decrements available and increments reserved.
5. Reservation release uses one conditional database update requiring `reservedQuantity >= quantity`, then decrements reserved and restores available.
6. Reservation consumption uses one conditional database update requiring `reservedQuantity >= quantity`, then decrements reserved only.
7. Internal reservation quantities must be positive integers no greater than 1,000,000.
8. Catalog exposes these commands through `CatalogModuleApi`; no other module may directly mutate Inventory persistence.
9. These atomic primitives participate in the checkout-wide database transaction, which composes cross-domain writes under one transaction boundary without leaking Prisma into module APIs.

## Why

This model directly implements the blueprint's available/reserved inventory schema and atomic-update guidance while protecting reserved stock from seller/client manipulation.

## Consequences

- concurrent reservation of the final unit is safe at the inventory statement level;
- seller changes do not overwrite reserved units;
- checkout composes inventory with order/payment creation through shared transaction orchestration;
- no Prisma schema or migration change is required for this document.
