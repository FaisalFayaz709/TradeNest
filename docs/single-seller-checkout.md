# Single-Seller Checkout Hardening

## Blueprint basis

TradeNest is a multi-vendor marketplace, but the Technical Blueprint makes a
specific MVP decision: checkout is initially restricted to **one seller per
order** while shipment, dispute, payment, and escrow lifecycles are stabilized.
The future parent-order / seller-sub-order model is explicitly deferred.

The quote and checkout implementations already enforce the rule.
This capability hardens that invariant so later development cannot accidentally weaken
it.

## Invariant

For every checkout quote and every newly created MVP order:

- all cart products must resolve to exactly one seller ID;
- the seller must then pass the existing ACTIVE-seller policy;
- mixed-seller carts fail with HTTP 409 and
  `MULTI_SELLER_CHECKOUT_NOT_SUPPORTED`;
- rejection occurs before inventory reservation, order creation, payment
  creation, cart closure, or idempotency-response storage.

## Defense in depth

The invariant is now checked at two layers:

1. **CheckoutService** rejects mixed-seller product snapshots before any
   checkout write occurs.
2. **OrdersRepository** rejects a create request whose immutable OrderItem
   snapshots contain more than one seller ID, before Prisma `order.create` is
   called.

The repository check is an internal safety net, not a second marketplace model.

## Deliberately not implemented

This capability does not introduce:

- parent orders;
- seller sub-orders;
- seller-specific payment settlement;
- seller-specific escrow rows;
- split shipments;
- automatic cart splitting;
- partial seller checkout;
- a database `seller_id` column on `orders`;
- new payment, escrow, shipment, or dispute behavior.

Those belong to a future multi-seller evolution and are not part of the MVP.

## Runtime acceptance

After installing dependencies under Node.js 24, run:

```bash
pnpm --filter @tradenest/api verify:single-seller-checkout
```

The verifier proves:

- mixed-seller quote is rejected with the correct 409 error;
- mixed-seller checkout creation is rejected;
- rejection happens before inventory/payment/order/cart/idempotency writes;
- same-seller multi-item quote remains valid;
- OrdersRepository refuses mixed-seller item snapshots before Prisma is called.
