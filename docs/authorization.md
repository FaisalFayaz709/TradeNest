# Authorization Infrastructure

TradeNest authorization is layered:

1. **Authentication** — `AccessTokenGuard` establishes an active authenticated principal.
2. **RBAC** — `RequireRoles(...)` + `RolesGuard` can restrict actions to blueprint roles.
3. **Ownership** — `AuthorizationService.requireOwnership(...)` checks the resource owner, independent of role.
4. **Domain policy** — `AuthorizationService.requirePolicy(...)` is the common denial primitive for feature-specific business policy.

This directly preserves the blueprint rule that RBAC is necessary but insufficient: resource ownership and domain policy checks are also required.

## Safe default

`requireOwnership` does **not** automatically let an `ADMIN` bypass ownership. Any admin override must be explicit (`allowAdmin: true`) in the feature that the blueprint permits to perform that admin action.

## Address policy

The `/users/me/addresses/:addressId` mutations load an address within the Users module, compare its `userId` to the authenticated principal, and conceal ownership failures as `404 ADDRESS_NOT_FOUND`. Seller/Buyer/Admin role labels do not grant another user's address access.

## Account deletion

The blueprint names an account deletion workflow but does not define retention/anonymization semantics. This capability therefore uses a conservative implementation decision:

- attempt deletion of the authenticated user only;
- allow existing PostgreSQL foreign-key policy to protect commerce history;
- if a protected relationship blocks deletion, return `409 ACCOUNT_DELETION_REQUIRES_REVIEW`;
- do not invent a `DELETED` enum value;
- do not mutate Orders, Payments, Escrow, Seller, or other module-owned records from UsersModule.

A future retention/compliance policy can replace this workflow only through an explicit ADR compatible with the blueprint.
