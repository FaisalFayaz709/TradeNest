# ADR-012 — Authoritative checkout quote

- Status: Accepted for this decision
- Scope: implementation details not fully locked by the blueprint

## Context

The blueprint locks `POST /checkout/quote`, backend-authoritative pricing, current
stock/seller/product revalidation, and the recommendation that the MVP use one
seller per order. It does not define shipping-price or discount formulas.

## Decision

- Coordinate quote generation inside OrdersModule; do not introduce an extra
  marketplace microservice or a new top-level business module.
- Read Cart, Catalog, and Seller state only through their explicit public module
  APIs.
- Enforce one seller and one currency per quote.
- Compute authoritative monetary values with integer minor-unit arithmetic from
  PostgreSQL/Prisma decimal strings; never use JS floating point for totals.
- Use a replaceable server-side `CheckoutPricingPolicy`.
- Until shipping/discount business rules are specified, the MVP policy returns
  zero shipping and zero discount adjustments.
- Quoting never reserves inventory.

## Consequences

The endpoint can produce a deterministic authoritative quote today without
inventing client-authoritative pricing or hidden promotion/shipping logic. The
pricing policy can later be replaced while preserving the backend authority and
public quote contract.
