# ADR-008 — Seller onboarding and ACTIVE-seller policy

- **Status:** Accepted for this decision
- **Classification:** Allowed implementation decisions constrained by the locked TradeNest blueprint

## Context

The blueprint locks Seller endpoints for onboarding/profile/dashboard and states that only an `ACTIVE` seller may create products. It does not define the full seller-status enum, onboarding request fields, slug-generation behavior, or dashboard response composition.

## Decision

- Public seller routes require authenticated `SELLER` role.
- `POST /seller/onboard` creates the user's one seller profile and sets it to `ACTIVE`, implementing the blueprint phrase “Create/activate seller profile.”
- Onboarding accepts `storeName`; NestJS derives a stable slug.
- `PATCH /seller/profile` changes `storeName` only and keeps the slug stable.
- Seller status remains a string in the shared response contract rather than introducing a closed enum.
- The public SellerModule API exposes `requireActiveSeller(userId)` for Catalog product-creation policy enforcement.
- The onboarding dashboard remains profile-focused; richer seller metrics, orders, and catalog data are exposed through dedicated endpoints.

## Rejected alternatives

- Invent a `PENDING/APPROVED/SUSPENDED/REJECTED` seller lifecycle: rejected because the source does not define it.
- Let clients supply or arbitrarily mutate seller status: rejected because status is authoritative backend state.
- Let Catalog read `seller_profiles` directly: rejected because it violates modular-monolith ownership.
- Add placeholder seller products/orders/analytics to onboarding: rejected because those concerns belong to their dedicated modules and endpoints.
