# TradeNest Notifications — Notifications: Scope and Acceptance

## Locked scope

The Technical Blueprint includes a `notifications` persistence table and `Notifications` module inside the NestJS modular monolith. Its route table does not prescribe notification endpoints. Four JWT/RBAC-protected routes have been approved as additive REST extensions, without touching the 74 mandated blueprint endpoints. Technology stack, original blueprint, `SPEC_LOCK.yaml`, historical migrations, and NestJS ownership boundaries are preserved.

## Delivered in source

- One durable in-app notification per `(event key, recipient)`, with a nullable unique index for legacy notifications.
- Transaction-coupled writes for checkout created, buyer cancellation, completed delivery/release, verified payment success/failure, shipment, dispute opening/resolution, confirmed refund, and admin account/seller/product moderation.
- No notifications for provisional refunds; the refund reconciler emits only after final provider-confirmed database completion.
- Buyer/seller/admin notification feed, read, mark-all-read and pagination UI.
- Shared Zod contracts and strict recipient scoping. No browser-authoritative financial changes.

## Acceptance in locked environment

1. Resolve Foundation's real `pnpm-lock.yaml` and frozen install with Node.js 24/pnpm 10.15.1.
2. Migrate a **fresh isolated local** PostgreSQL 18 `tradenest_notifications_test` database, with `schema=public` and `NODE_ENV=test`.
3. `pnpm verify:notifications` checks 74 required routes, permission scoping, migrations and notification event paths.
4. `pnpm acceptance:notifications` executes cumulative acceptance, Prisma/Jest/TypeScript, the live notification HTTP and transactional test, and Playwright.
5. Verify idempotent replay, transaction rollback, no cross-user visibility, correct auth errors, and event emission on real buyer/seller/admin workflows.
6. Do not promote without a passing real migration and a successful full runtime suite.

## Known limitations

- Source checks and TypeScript syntax parsing do **not** establish a successful typecheck, Prisma Client generation, NestJS dependency injection at runtime, or proper production configuration.
- No genuine dependency lockfile or configured PostgreSQL 18 instance is present in the evaluation environment.
- Email, SMS and push delivery are not provided. They are not mandated by the original blueprint.
- Pending-payment expiration worker notifications and non-financial dispute chat alerts are possible later additions; core order/payment/dispute/moderation transitions are covered.
- Historical order/notification backfills are not included; there is no synthetic event generation.
