# ADR-024: Wishlist lives inside UsersModule

## Status
Accepted for this decision.

## Context
The locked modular monolith lists Auth, Users, Catalog, Cart, Orders, Payments, Escrow, Shipping, Disputes, Seller, Analytics, AI Bridge, Admin and Notifications. It does not define a separate Wishlist module, while the API blueprint does define Buyer wishlist endpoints and the database already defines `wishlist_items` as a user/product relation.

## Decision
Wishlist is a feature inside `UsersModule` because the relation is owned by the authenticated Buyer. `UsersRepository` remains the only Users-module persistence adapter. Product eligibility is checked through the explicit `CatalogModuleApi` public boundary; Users does not query Product persistence directly.

## Consequences
- no new marketplace module or deployable;
- no Users-to-Catalog internal/repository import;
- wishlist does not own product price, stock, seller state, checkout, or recommendations;
- the existing `(user_id, product_id)` uniqueness constraint remains authoritative;
- no Prisma schema change or migration is required.
