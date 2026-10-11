# Admin Frontend

This capability implements the blueprint Admin page family in the existing Next.js application while preserving NestJS as the marketplace and financial authority.

## Runtime pages

The Admin workspace includes:

- Overview
- Users
- Sellers
- Products
- Orders and order detail
- Payments
- Escrow
- Disputes and dispute detail
- Fraud Alerts
- Reports
- Settings

`AdminGate` requires an authenticated `ADMIN` session. Public registration still creates only permitted public account roles; there is no Admin registration route.

## Same-origin web boundary

The browser continues to call the same-origin `/api/tradenest/...` BFF. The BFF keeps JWT access and refresh tokens in HttpOnly cookies and forwards only allowlisted marketplace routes.

This capability adds Admin allowlist entries for dashboard/collection reads, fraud alerts, and the existing Admin dispute-resolution command. It does not expose payment webhooks, direct escrow release/refund commands, or arbitrary state mutation routes.

## Admin read aggregation

The Admin module does not become a persistence owner for the rest of the marketplace. AdminService obtains data through explicit public APIs owned by:

- UsersModule
- SellerModule
- CatalogModule
- OrdersModule
- PaymentsModule
- EscrowModule
- DisputesModule
- AnalyticsModule

This preserves the modular-monolith rule that a module must not directly mutate or query another module's persistence simply because all modules share PostgreSQL.

## Mutation policy

This capability does not create new Admin write authority merely to populate UI controls.

The UI reuses only backend commands that already exist and already carry domain checks:

- Product deletion where Admin is already authorized.
- Dispute resolution through `POST /admin/disputes/:id/resolve`, with a stable `Idempotency-Key` and only the domain resolutions `REFUND_BUYER` or `RELEASE_TO_SELLER`.

User/seller status controls remain read-only because the current repository does not expose dedicated audited suspension/activation commands. Payments remain provider-authoritative, and direct escrow release/refund is not exposed by the browser surface.

## Reports and settings

Reports are read-only summaries calculated from Admin collection responses; this capability adds no reporting datastore.

Settings is intentionally non-mutating. The blueprint defines an Admin Settings page family but does not define a safe browser API for runtime infrastructure/secrets configuration, so the page exposes system boundaries/status rather than inventing configuration persistence.
