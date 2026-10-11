# SellerModule

**Boundary responsibility:** seller onboarding/profile and seller-facing coordination.

Implemented in this module:

- `POST /api/v1/seller/onboard`
- `GET /api/v1/seller/profile`
- `PATCH /api/v1/seller/profile`
- `GET /api/v1/seller/dashboard`
- public `requireActiveSeller(userId)` policy seam used by Catalog

Architecture:

```text
SellerController
  -> SellerService
  -> SellerRepository
  -> PrismaService
  -> PostgreSQL
```

Only `SellerRepository` accesses Prisma. Other modules may not import it; the supported cross-module seam is `seller/public/`.

## Status policy

The blueprint explicitly uses `ACTIVE` as the condition for product creation but does not define the complete seller-status vocabulary. This module therefore:

- creates/activates the seller profile with `status = ACTIVE` during onboarding;
- tests exact `ACTIVE` in `requireActiveSeller()`;
- does not introduce a closed SellerStatus enum or invent states such as `PENDING`, `SUSPENDED`, or `REJECTED`.

## Conservative profile decisions

The source specifies `store_name`, `slug`, `status`, and `rating`, but not request fields. This module therefore accepts only `storeName` during onboarding and profile update. NestJS derives a stable slug during onboarding and does not silently rewrite it when the store display name changes. Rating remains system-owned.

The onboarding dashboard is intentionally minimal (`{ profile }`). Orders, products, analytics, AI insights, payments, escrow, and disputes are exposed through their dedicated module surfaces.
