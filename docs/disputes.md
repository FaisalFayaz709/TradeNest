# Disputes

Source: TradeNest Technical Blueprint §§5.7, 7, 8.7, 11.

## HTTP surface

- `POST /api/v1/orders/:id/disputes` — Buyer opens one dispute for an eligible owned order.
- `GET /api/v1/disputes/:id` — Buyer/Seller participant or Admin.
- `POST /api/v1/disputes/:id/messages` — Buyer/Seller participant or Admin while OPEN.
- `POST /api/v1/disputes/:id/evidence` — Buyer/Seller participant while OPEN.
- `POST /api/v1/admin/disputes/:id/resolve` — Admin; requires `Idempotency-Key` because the command can release/refund funds.

## Opening policy

An order is eligible only when it has reached a paid fulfillment state represented by `PAID`, `PROCESSING`, or `SHIPPED`, the authenticated Buyer owns the order, the MVP order contains exactly one seller, and Escrow is `HELD` or `SELLER_SHIPPED`.

Opening runs in one serializable transaction:

```text
Dispute = OPEN
Order   = DISPUTED
Escrow  = DISPUTED
```

The existing database uniqueness rule `Dispute.orderId UNIQUE` enforces one dispute per order.

## Review and resolution

The blueprint does not define a separate Dispute `UNDER_REVIEW` status. The existing Dispute record therefore remains `OPEN` during review while the Escrow state machine owns the review transition:

```text
DISPUTED -> UNDER_REVIEW -> RELEASED | REFUNDED
```

Admin resolution is one financial transaction. `REFUND_BUYER` calls the provider-neutral payment refund seam, records a `REFUND` escrow ledger entry, sets Order `REFUNDED`, resolves the Dispute, and writes audit logs. `RELEASE_TO_SELLER` records a `RELEASE` ledger entry, sets Order `COMPLETED`, resolves the Dispute, and writes audit logs.

## Messages and evidence

Messages never render as trusted HTML; they are stored as plain text. Evidence is registered as an object-storage reference (`objectKey`, URL and optional filename/MIME metadata). This capability does not invent an upload vendor or carrier-like integration; S3-compatible storage or Cloudinary remains the locked storage choice and the concrete upload workflow may be attached later.

## Automatic release

`DisputesModuleApi.hasActiveDispute()` continues to expose the read-only policy seam used by buyer delivery confirmation. An OPEN dispute therefore continues to block automatic release.
