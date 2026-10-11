# ADR-011 — Buyer Cart Boundary

**Status:** Accepted for this decision
**Classification:** Allowed implementation decisions under locked blueprint rules

## Decision

1. `GET /cart` creates the authenticated buyer's active cart if one does not yet exist.
2. Adding the same product again increments the existing cart row using the database unique `(cart_id, product_id)` constraint and Prisma upsert.
3. Cart API responses intentionally omit prices, totals, inventory promises, and seller-state promises.
4. Add-item checks only current `ACTIVE` product eligibility through CatalogModule's public service interface. It does not reserve inventory.
5. Clear-cart deletes cart items while retaining the active cart container.

## Locked blueprint constraints preserved

- cart is not a price/inventory guarantee;
- frontend never supplies authoritative price;
- checkout will reload product, seller, price, and stock;
- positive quantity is validated at application and database layers;
- modules communicate through explicit boundaries rather than cross-table access.
