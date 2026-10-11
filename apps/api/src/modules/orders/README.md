# OrdersModule

OrdersModule coordinates both this module authoritative quote and this module
transactional checkout creation.

`POST /api/v1/checkout` requires an authenticated BUYER, an owned
`shippingAddressId`, and an `Idempotency-Key` header. It executes a serializable
PostgreSQL transaction that:

1. reloads the active cart;
2. snapshots the owned shipping address;
3. reloads current ACTIVE product/price/inventory state;
4. verifies the single seller is ACTIVE;
5. enforces the one-seller and one-currency MVP boundaries;
6. calculates authoritative totals using integer minor-unit arithmetic;
7. reserves inventory through CatalogModule;
8. creates an Order in `PENDING_PAYMENT` with immutable item snapshots;
9. creates a `PENDING` payment record through PaymentsModule;
10. closes the checked-out cart through CartModule;
11. stores the exact response under the Idempotency-Key; and
12. commits all effects together.

Any failure rolls the entire transaction back. No escrow is created and no
payment is declared successful in this document.
