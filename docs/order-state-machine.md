# TradeNest Order State Machine

## Blueprint authority

This capability implements and hardens the Order state machine defined in the Technical Blueprint. Authoritative order status is never accepted from the browser. State changes use command/service operations backed by compare-and-update persistence rules.

Locked order states:

`PENDING_PAYMENT -> PAID -> PROCESSING -> SHIPPED -> DELIVERED -> COMPLETED`

Alternative/branch states: `CANCELLED`, `DISPUTED`, `REFUNDED`.

## HTTP surface

- `GET /api/v1/orders` — Buyer order list.
- `GET /api/v1/orders/:id` — authorized Buyer/Seller participant or Admin.
- `POST /api/v1/orders/:id/cancel` — owning Buyer, when eligible.

Shipping and buyer delivery confirmation are implemented through their dedicated module boundaries and command seams.

## Cancellation policy

The blueprint states that an eligible buyer cancellation before successful payment may cancel the order and restore reserved inventory. This capability defines eligibility conservatively:

1. the authenticated principal is the owning Buyer;
2. Order is `PENDING_PAYMENT`;
3. no succeeded payment exists;
4. no externally initialized provider payment is currently pending.

A checkout-created `INTERNAL_PENDING` payment record does not block cancellation. A provider-initialized pending payment does block cancellation because the blueprint does not define a provider payment-intent cancellation operation; locally cancelling while an external charge can still complete would violate financial integrity.

The cancellation operation is one serializable transaction:

1. lock the Order row `FOR UPDATE`;
2. re-read authoritative order/items;
3. verify ownership and state;
4. verify payment cancellation context through PaymentsModule;
5. compare-and-update `PENDING_PAYMENT -> CANCELLED` and set `cancelled_at`;
6. restore every reserved item through CatalogModule;
7. commit.

If any inventory restoration fails, the order cancellation rolls back.

A repeated cancellation is idempotent by state: an already `CANCELLED` order is returned and inventory is not restored a second time.

## Payment/cancellation serialization

`OrdersRepository.findPaymentContext()` locks the Order row when called inside a database transaction. Payment initiation already resolves its payable Order through this public OrdersModule seam. Therefore provider payment initialization and cancellation serialize on the same Order row.

## Read authorization

`GET /orders/:id` permits:

- owning Buyer;
- Seller whose seller ID exists in an immutable OrderItem snapshot;
- Admin.

Non-participants receive concealed `404 ORDER_NOT_FOUND`.

## State transition enforcement

`order-state-machine.ts` provides the shared `assertOrderTransition()` / `invalidOrderTransition()` guard. Current implemented command transitions are:

- verified provider payment: `PENDING_PAYMENT -> PAID`;
- eligible buyer cancellation: `PENDING_PAYMENT -> CANCELLED`;
- escrow release: `DELIVERED|DISPUTED -> COMPLETED`;
- escrow refund: `PAID|PROCESSING|DISPUTED -> REFUNDED`.

Database compare-and-update predicates remain a second enforcement layer.

There is no `PATCH /orders/:id` authoritative-status endpoint.
