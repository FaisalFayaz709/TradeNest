# Seller onboarding and profile

## Source-supported surface

The TradeNest blueprint assigns Seller the following endpoints in section 5.3:

- `POST /seller/onboard` — create/activate seller profile
- `GET /seller/profile` — seller profile
- `PATCH /seller/profile` — update seller profile
- `GET /seller/dashboard` — seller summary

It also states in core product logic that only an **ACTIVE** seller may create products.

This document covers seller onboarding/profile semantics only. Seller products, orders, analytics, AI insights, payments, escrow, and disputes are implemented through their dedicated module surfaces.

## Request/response decisions that are not locked by the blueprint

The blueprint does not specify onboarding form fields, slug mechanics, the complete seller-status vocabulary, or the contents of the seller dashboard. To avoid silently inventing product requirements, this capability adopts narrow implementation decisions:

1. Onboarding accepts only `storeName`.
2. NestJS derives a stable slug from store name + a user-id suffix.
3. The profile update can change `storeName` only. The slug remains stable.
4. Onboarding writes the explicit blueprint-required usable state `ACTIVE`.
5. The contract does not close seller status into an enum; future status values remain open.
6. The onboarding dashboard payload remains `{ profile }`; richer seller metrics, orders, and catalog data are exposed through dedicated endpoints.
7. Rating is read-only and returned if present.

These are implementation decisions, not changes to the locked specification.

## Authorization

All this capability routes require:

1. a valid access token/session;
2. the `SELLER` account role;
3. ownership by construction because the seller profile key is the authenticated user's id.

The public cross-module policy method `requireActiveSeller(userId)` lets Catalog enforce the blueprint rule without reading `seller_profiles` or Prisma directly.

## Module boundary

```text
HTTP
 -> SellerController
 -> SellerService
 -> SellerRepository
 -> PrismaService
 -> PostgreSQL 18
```

Other modules may depend only on `seller/public/`.
