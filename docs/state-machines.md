# Domain State Machines

Source: TradeNest Technical Blueprint §7 and supporting business logic in §8.

These state machines are **domain rules**, not UI decoration.

Clients must not PATCH arbitrary status values. State changes occur through command-style operations such as cancel, create shipment, confirm delivery, resolve dispute, release and refund.

Illegal transitions return a conflict such as:

```text
HTTP 409
INVALID_STATE_TRANSITION
```

## Order state

Primary path:

```text
PENDING_PAYMENT
      |
      | payment succeeds
      v
     PAID
      |
      v
 PROCESSING
      |
      v
   SHIPPED
      |
      v
  DELIVERED
      |
      v
 COMPLETED
```

Alternative branch/terminal states defined by the blueprint:

```text
CANCELLED
DISPUTED
REFUNDED
```

The blueprint defines these states and command behavior but does not fully enumerate every legal edge among all branch states. Do not invent unrestricted transitions; encode legal transitions deliberately in domain services/policies.

## Escrow state

Primary path:

```text
PENDING
   |
   | verified payment
   v
 HELD
   |
   | seller ships
   v
SELLER_SHIPPED
   |
   | buyer confirms
   v
BUYER_CONFIRMED
   |
   v
RELEASED
```

Dispute path:

```text
HELD / SELLER_SHIPPED
          |
          v
       DISPUTED
          |
          v
     UNDER_REVIEW
       /       \
      v         v
 RELEASED    REFUNDED
```

## Product state

```text
DRAFT -> ACTIVE -> ARCHIVED
          |
          +----> SUSPENDED   (admin moderation)
```

## Separate state machines are mandatory

Order, payment and escrow are separate state machines. Do not collapse them into one status field or infer one solely from another without domain logic.

## Command boundary

Examples of blueprint command-style operations:

- cancel order;
- create shipment;
- confirm delivery;
- resolve dispute;
- release escrow;
- refund escrow/payment.

Do not expose generic endpoints that let clients choose arbitrary authoritative statuses.
