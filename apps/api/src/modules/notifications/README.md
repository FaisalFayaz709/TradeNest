# NotificationsModule — Notifications

Owns database-backed **in-app notifications** for buyers, sellers, and administrators.

* `NotificationsModuleApi.record(event, tx)` is the **only** cross-module call and requires the caller's `DatabaseTransactionContext`. Writes roll back if an order/payment/dispute/moderation transaction fails.
* Each event's unique `event_key` (`event.key:userId`) is persisted via `createMany(skipDuplicates)`; webhook replays and job retries do not duplicate notifications. The key is bounded and caller-generated, not browser supplied.
* User reads use JWT and RBAC; every read and update is scoped to `principal.userId` in the repository, including read-all. Unknown/unowned IDs return 404.
* Routes (additional blueprint-compatible endpoints): `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` under `/api/v1`.
* Delivery is in-app only, **not SMTP/SMS/push**. Notifications do not assert financial truth; they reflect verified backend transitions.
* The existing `notifications` table gains only nullable, unique `event_key` via additive migration `202610080009`.
* No separate queue, Redis, or microservice was introduced.

Runtime acceptance: `pnpm acceptance:notifications` requires the locked Node 24, pnpm 10.15.1, PostgreSQL 18 and a local isolated `TEST_DATABASE_URL` with `schema=public`.
