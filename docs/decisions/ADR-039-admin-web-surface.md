# ADR-039 — Admin web surface through owner-module read APIs

## Decision

Implement the Admin runtime in the existing Next.js application. Add Admin collection/dashboard reads by extending each owning NestJS module's public API and aggregating those seams in AdminModule.

Do not give AdminModule direct Prisma access and do not add generic cross-module repositories.

## Constraints

- Admin authentication requires the existing `ADMIN` role; Admin is not publicly registerable.
- JWT/refresh tokens remain unavailable to browser JavaScript.
- No Prisma schema or migration change.
- No browser command can declare payment success.
- No direct browser escrow release/refund command.
- No arbitrary order/payment/escrow status PATCH.
- No invented user/seller suspension command until a dedicated audited domain command exists.
- Existing dispute resolution remains transactional, idempotent, and audited.
- Fraud-risk output remains advisory.

## Consequence

Admin users can inspect marketplace operations and perform the existing governed moderation/dispute actions without turning AdminModule into a bypass around domain ownership or financial state machines.
