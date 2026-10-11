# Payment Abstraction and Verified Provider Boundary

## Blueprint-derived requirements

This capability implements the payment API and the verified payment-success boundary described by the TradeNest Technical Blueprint:

- `POST /api/v1/orders/:orderId/payments` — Buyer
- `GET /api/v1/payments/:id` — Owner/Admin
- `POST /api/v1/payments/webhooks/:provider` — payment provider
- financial writes support `Idempotency-Key`
- payment success is never accepted from the browser
- provider webhook signatures are verified
- provider amount and currency must match authoritative backend state
- successful payment finalization is one transaction: `Payment = SUCCEEDED`, `Order = PAID`, `Escrow = HELD`, append `HOLD`
- duplicate successful webhooks must not create duplicate escrow/ledger state

## Implementation decisions not locked by the blueprint

The blueprint does not select a production gateway. This capability therefore provides a provider-neutral `PaymentProvider` interface and a development-only `sandbox` adapter.

The sandbox adapter:

- generates deterministic `sandbox_<payment-id>` provider IDs;
- verifies `x-tradenest-signature` as `HMAC-SHA256(raw request bytes)`;
- supports `PAYMENT_SUCCEEDED` and `PAYMENT_FAILED` development events;
- is selected with `PAYMENT_PROVIDER=sandbox`.

This is not a claim that the production provider has been selected. A real provider must be introduced later through an ADR and adapter without moving financial authority to the browser.

## Raw-body requirement

Webhook signature verification is performed over the original request bytes. NestJS is therefore bootstrapped with `rawBody: true`, and the webhook controller passes the captured bytes and request headers into the provider adapter.

## Module ownership

- PaymentsModule owns payment records and provider adapters.
- OrdersModule owns order state and exposes `markPaidFromVerifiedPayment` through its public API.
- EscrowModule owns escrow/ledger records, including HOLD plus release/refund command orchestration.
- PaymentsModule coordinates the verified success transaction through those public seams.
- No controller accesses Prisma.
- PaymentsRepository does not mutate Order/Escrow tables.
- OrdersRepository does not mutate Payment/Escrow tables.
- EscrowRepository does not mutate Payment/Order tables.

## Related workflow status

The implementation includes escrow read/release/refund foundations and a provider-neutral refund seam. Shipping-linked transitions, buyer confirmation, cancellation/refund, and disputes are implemented in their owning modules. Production gateway selection and provider-specific client redirect/client-secret UX remain open deployment/product decisions.
