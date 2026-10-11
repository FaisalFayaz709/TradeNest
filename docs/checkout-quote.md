# Authoritative Checkout Quote

## Blueprint contract

TradeNest exposes `POST /api/v1/checkout/quote` as a Buyer operation. A cart is
not a price or inventory guarantee: checkout must reload current product state,
seller state, authoritative prices, and inventory. The frontend never submits a
trusted final price.

## Implemented flow

1. Authenticate the Buyer.
2. Read the Buyer's active cart through CartModule's public boundary.
3. Reject an absent/empty cart.
4. Reload each product through CatalogModule's checkout snapshot boundary.
5. Require every product to remain ACTIVE.
6. Enforce the recommended MVP one-seller-per-order rule.
7. Require that seller to remain ACTIVE through SellerModule.
8. Require a single order currency.
9. Verify current available quantity for every line.
10. Calculate line totals and subtotal on the backend using integer minor units.
11. Apply the server-owned checkout pricing policy.
12. Return an authoritative quote with `inventoryReserved: false`.

## Explicit non-goals

This capability does not reserve stock, create an Order, create immutable OrderItem
snapshots, create a Payment intent/record, or mutate Escrow. Those operations
belong to the transactional checkout and payment capabilities.

## Shipping and discount gap

The blueprint requires shipping and discount values to be calculated by the
backend but does not define the rules. This capability uses a replaceable
`CheckoutPricingPolicy` with zero shipping and zero discount adjustments. This is
an allowed implementation decision and is not promoted to a locked specification.
