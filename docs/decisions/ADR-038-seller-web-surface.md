# ADR-038 — Seller web surface and read collections

## Decision

Implement the Seller runtime in the existing Next.js application and extend the shared BFF allowlist for Seller-safe routes. Keep marketplace business authority in NestJS.

Add `GET /seller/orders` inside OrdersModule because the blueprint defines this Seller API and the repository lacked it. Add `GET /seller/disputes` inside DisputesModule as a read-only implementation decision needed by the blueprint Seller Disputes page family.

## Constraints

- No Prisma schema/migration change.
- No direct Controller → Prisma access.
- No Seller access to Admin dispute resolution or escrow release/refund commands.
- No widening of Buyer/Admin payment-detail permissions.
- No AI-driven automatic price mutation.
- No browser-held JWT/refresh token.

## Consequence

Seller UI can operate catalog, stock, fulfillment, analytics, AI advice and dispute participation while domain ownership and financial authority stay in their existing backend modules.
