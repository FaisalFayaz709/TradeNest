# ADR-007 — Users, Addresses, and Authorization

**Status:** Accepted for this decision
**Scope:** Implementation decisions left open by the TradeNest blueprint

## Locked source requirements

- `GET /users/me`, `PATCH /users/me`, `DELETE /users/me`.
- Owned-address list/create/update/delete endpoints.
- JWT-authenticated API calls.
- RBAC plus ownership/policy checks; role checks alone are insufficient.
- Controllers do not call Prisma directly.

## Decisions

1. `PATCH /users/me` edits only `name` in this decision. Email mutation is deferred because verification/re-authentication semantics are not defined by the blueprint.
2. Address DTO fields mirror this decision address persistence decision. These fields remain implementation choices rather than newly locked product requirements.
3. Address ownership failures are concealed as `404 ADDRESS_NOT_FOUND` to avoid confirming another user's resource IDs.
4. `AuthorizationService` defaults to **no ADMIN ownership bypass**. Admin bypass must be explicit per domain action.
5. Account deletion uses a conservative hard-delete attempt. PostgreSQL `RESTRICT` relationships protect historical marketplace data; a blocked delete becomes `409 ACCOUNT_DELETION_REQUIRES_REVIEW`. No `DELETED` account state is invented.
6. Only `UsersRepository` may reach Prisma from UsersModule.

## Consequences

- The Users module stays within its domain boundary.
- Historical order/payment/escrow records cannot be casually destroyed by a profile endpoint.
- Future email-change, retention, anonymization, or legal-deletion rules need their own ADR instead of being hidden inside this document.
