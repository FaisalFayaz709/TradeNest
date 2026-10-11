# Locked Domain and Business Rules

Source: TradeNest Technical Blueprint §§7–12, 16.

## Identity and authentication

- Public registration may create Buyer/Seller-capable accounts.
- `ADMIN` must never be publicly registerable.
- Passwords are hashed with bcrypt; plaintext passwords are never stored.
- Access tokens are JWTs.
- Refresh tokens are stored as hashes, rotated on refresh, and revocable per session or globally.
- Suspended/banned users must not authenticate even with a correct password.

## Authorization

Authorization is not only role-based.

Required layers:

```text
Authenticated identity
       ↓
RBAC
       ↓
Resource ownership
       ↓
Domain/policy checks
```

Example: being a `SELLER` is not sufficient to edit a product; the seller must own that product unless an authorized admin action applies.

## Product rules

- Only an `ACTIVE` seller may create products.
- Category must exist.
- Price and stock must satisfy validation/integrity rules.
- Product + Inventory are created in one transaction.
- New products begin as `DRAFT`.
- Activation occurs via publish rules/command, not arbitrary status assignment.

## Cart and pricing

A cart is convenient state, **not** a price or inventory guarantee.

At checkout, the backend reloads:

- products;
- product status;
- seller status;
- authoritative prices;
- stock.

The browser never supplies a trusted final price.

## Checkout transaction

The blueprint requires a transactional sequence equivalent to:

```text
BEGIN TRANSACTION
load cart
lock / atomically update inventory
for each item:
  verify product ACTIVE
  verify seller ACTIVE
  verify sufficient inventory
  read current authoritative price
calculate subtotal / shipping / discount / total
reserve inventory
create order
create immutable order-item snapshots
create payment intent/record
COMMIT
```

Any failure rolls back the transaction. Inventory reservation must be concurrency-safe.

## Historical order data

Order items preserve historical product information (including name, SKU and price snapshots) so later catalog changes do not rewrite order history.

## Payment success

The client can never declare payment success.

A valid success flow is:

```text
payment-provider webhook/state
→ verify signature
→ locate provider transaction
→ idempotency check
→ validate expected amount/currency
→ transactional state change
```

Within the payment-success transaction:

- Payment becomes `SUCCEEDED`;
- Order becomes `PAID`;
- Escrow becomes `HELD`;
- a `HOLD` escrow-ledger entry is appended.

## Shipping and confirmation

Seller shipment is permitted only for an eligible paid/processing order with escrow held.

Shipment moves:

```text
Order  -> SHIPPED
Escrow -> SELLER_SHIPPED
```

Buyer delivery confirmation must verify:

- buyer ownership;
- eligible order state;
- escrow is unreleased;
- no active dispute.

A valid confirmation completes the order and releases escrow transactionally with a ledger entry.

## Cancellation/refund boundary

Before successful payment, an eligible cancellation may cancel the order and restore reserved inventory.

After funds are captured/held, cancellation becomes a **refund workflow**, not a simple status change.

## Disputes

Opening an eligible dispute moves escrow into a disputed state. While a dispute is open, automatic release is blocked.

Admin resolution may:

- refund buyer → Escrow `REFUNDED`, Order `REFUNDED`; or
- release seller → Escrow `RELEASED`, Order `COMPLETED`.

Refund/release decisions must be audited.

## Reviews

- Only a buyer with a completed purchased order item may review that product.
- Rating is 1–5.
- Database enforces at most one review per purchased order item.

## Money handling

Authoritative monetary calculations must not rely on ordinary JavaScript floating-point arithmetic.

Blueprint-compatible representations are:

- PostgreSQL `NUMERIC`; or
- consistently used integer minor units.

All totals are calculated by the backend from authoritative prices.

## Idempotency

Financial write operations should use an `Idempotency-Key` model that stores the key, user, operation and original response. Repeating the same operation with the same key returns the original result and must not create a second order/payment/refund/release.

## Multi-seller MVP rule

For the initial MVP, restrict checkout to **one seller per order** while payment/escrow lifecycle reliability is stabilized.

Future evolution may use a parent order with seller sub-orders; that is not the initial implementation.

## AI boundaries

- Build the reliable transaction path before advanced AI.
- Recommendations assist users.
- Smart pricing may recommend a range but never silently change seller prices.
- Fraud MVP begins with rules/risk scoring; high risk normally triggers review rather than automatic accusation.
