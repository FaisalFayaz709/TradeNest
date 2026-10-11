# TradeNest Database Foundation

The TradeNest Technical Blueprint is the authority for this schema. This document distinguishes **LOCKED** database requirements from **ALLOWED IMPLEMENTATION DECISIONS** needed to materialize tables whose full columns were not specified.

## Locked persistence architecture

- One PostgreSQL 18 database.
- Prisma ORM 7 is the application persistence layer.
- PostgreSQL constraints are the final integrity boundary.
- Controllers do not call Prisma directly.
- Sharing one database does not allow one business module to mutate another module's records directly.

## Blueprint tables materialized

This capability creates all 26 tables named in blueprint section 6:

1. `users`
2. `user_sessions`
3. `seller_profiles`
4. `addresses`
5. `categories`
6. `products`
7. `product_images`
8. `inventory`
9. `carts`
10. `cart_items`
11. `orders`
12. `order_items`
13. `payments`
14. `escrows`
15. `escrow_transactions`
16. `shipments`
17. `disputes`
18. `dispute_messages`
19. `dispute_evidence`
20. `wishlist_items`
21. `reviews`
22. `user_events`
23. `ai_recommendations`
24. `fraud_assessments`
25. `notifications`
26. `audit_logs`

## Locked state/value sets represented as enums

The blueprint fully defines these domain state sets sufficiently for this capability:

- `UserRole`: `BUYER`, `SELLER`, `ADMIN`.
- `ProductStatus`: `DRAFT`, `ACTIVE`, `ARCHIVED`, `SUSPENDED`.
- `OrderStatus`: `PENDING_PAYMENT`, `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `COMPLETED`, plus `CANCELLED`, `DISPUTED`, `REFUNDED`.
- `EscrowStatus`: `PENDING`, `HELD`, `SELLER_SHIPPED`, `BUYER_CONFIRMED`, `RELEASED`, `DISPUTED`, `UNDER_REVIEW`, `REFUNDED`.
- `EscrowTransactionType`: `HOLD`, `RELEASE`, `REFUND`, `ADJUSTMENT`.
- `DisputeResolution`: `REFUND_BUYER`, `RELEASE_TO_SELLER`.
- behavior events: `PRODUCT_VIEW`, `WISHLIST`, `ADD_TO_CART`, `PURCHASE`.

Some vocabularies are not fully defined by the blueprint. This capability intentionally keeps seller status, shipment status, fraud risk level, notification type, and audit action as strings so separate implementation work can define policy without pretending those values were locked here.

`PaymentStatus` and `DisputeStatus` contain only the minimum lifecycle values needed by currently defined flows. They are documented as implementation-level sets in ADR-005 and may be extended by later migrations when a blueprint-supported feature requires it.

## Locked hard constraints

The migration enforces the blueprint's database guarantees:

- `UNIQUE(users.email)`.
- `UNIQUE(products.slug)`.
- `UNIQUE(payments.provider_payment_id)`.
- `UNIQUE(cart_id, product_id)` on cart items.
- `UNIQUE(order_item_id)` on reviews.
- `CHECK products.price >= 0`.
- `CHECK order_items.quantity > 0`.
- `CHECK reviews.rating BETWEEN 1 AND 5`.
- `CHECK inventory.available_quantity >= 0`.
- `CHECK inventory.reserved_quantity >= 0`.
- `CHECK payments.amount > 0` from the blueprint's detailed payment definition.

Prisma ORM 7 does not represent PostgreSQL CHECK constraints directly in `schema.prisma`, so those checks live in the SQL migration. They are still visible and honored by Prisma Client because PostgreSQL is the integrity boundary.

## Locked historical snapshots

`order_items` persists:

- product ID and seller ID references;
- product name snapshot;
- SKU snapshot;
- quantity;
- unit price;
- total price.

This prevents later catalog edits from rewriting transaction history.

`orders.shipping_address` is JSONB so checkout can persist an immutable address snapshot rather than depending on a mutable address row.

## Required indexes

The blueprint explicitly calls for indexes across product seller/category/status, order buyer/status/created time, payment provider identity, escrow order/status, dispute status, and user-event dimensions. This capability materializes those and a small number of supporting indexes for foreign-key/read paths.

## One active cart per user

The blueprint describes `carts` as one active cart per user but does not specify how to represent activity. This capability uses:

```text
carts.is_active BOOLEAN
```

plus a PostgreSQL partial unique index:

```sql
UNIQUE (user_id) WHERE is_active = true
```

This enforces exactly the blueprint invariant without preventing historical inactive carts.

## Money representation

Authoritative monetary columns use `Decimal` / PostgreSQL `NUMERIC` (`DECIMAL(12,2)` for commerce values). No authoritative price or amount field is represented as JavaScript/Prisma `Float`.

## Referential-action policy — implementation decision

The blueprint does not define every `ON DELETE` behavior. This capability uses a conservative policy:

- financial/history relationships use `RESTRICT` so history cannot disappear accidentally;
- clearly ephemeral owned records such as sessions, addresses, cart items, wishlist items and notifications use `CASCADE` where appropriate;
- analytical references that may outlive a user/product use `SET NULL` where the field is optional.

These rules are implementation decisions and may be refined only through an ADR and migration without weakening locked historical/financial integrity.

## Fields added where the blueprint gave only a table purpose

The blueprint names some tables without a complete column list. To make the schema runnable, this capability adds minimal practical fields. These are **not locked product requirements**:

- address components (`recipient`, `line1`, `city`, country code, etc.);
- category `name` and `slug`;
- image `object_key`, `url`, sort order, primary flag;
- cart `is_active`;
- review comment;
- behavior-event metadata;
- recommendation score;
- fraud-assessment subject references;
- notification title/body/read timestamp;
- audit actor/target/request/JSON before-after metadata;
- evidence storage metadata.

Later feature implementations may evolve these fields through migrations, but they may not remove or weaken blueprint-locked constraints or state/history guarantees.

## Applying and verifying the database

From a Node.js 24 + Docker environment:

```bash
pnpm install
pnpm infra:up
pnpm db:validate
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:foundation:verify
```

`db:foundation:verify` queries PostgreSQL system catalogs to confirm the expected 26 tables, hard CHECK constraints, and key indexes actually exist in the database.

## Persistence boundary

The schema defines persistence structure. Business logic reaches Prisma through module-owned repository/application persistence APIs, preserving the modular-monolith boundary; controllers do not access Prisma directly.


## Audit hardening and integrity constraints

The architecture verification applies the blueprint's generic hard-integrity rules consistently to all relevant persisted fields:

- `cart_items.quantity > 0`
- `order_items.quantity > 0`
- `reviews.rating BETWEEN 1 AND 5`
- `seller_profiles.rating IS NULL OR BETWEEN 1 AND 5`

These constraints strengthen PostgreSQL's role as the final integrity boundary and do not change any API contract or state machine.
