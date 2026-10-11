# Users module

Owns the authenticated user's profile and user-owned shipping addresses.

Blueprint endpoints implemented:

- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `DELETE /api/v1/users/me`
- `GET /api/v1/users/me/addresses`
- `POST /api/v1/users/me/addresses`
- `PATCH /api/v1/users/me/addresses/:addressId`
- `DELETE /api/v1/users/me/addresses/:addressId`

## Boundary rules

- Every endpoint requires the exported Auth module access-token guard.
- Controllers and services never access Prisma directly.
- `UsersRepository` is the sole Users-module persistence adapter.
- Address mutation requires ownership; a valid role alone never grants access.
- Failed address ownership is concealed as `ADDRESS_NOT_FOUND` to avoid resource enumeration.
- Profile editing is intentionally limited to `name`; email-change verification is not specified by the blueprint.
- Account deletion does not invent a `DELETED` status or erase protected commerce history. A hard delete is attempted only through PostgreSQL integrity rules; protected history returns `409 ACCOUNT_DELETION_REQUIRES_REVIEW`.

## wishlist

Buyer wishlist list/add/remove is owned here. Product eligibility is checked only through CatalogModule's public API; wishlist persistence stays in UsersRepository.
