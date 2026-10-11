# ADR-006 — Authentication and refresh sessions

**Status:** Accepted for this decision
**Classification:** Allowed implementation decisions constrained by locked blueprint requirements

## Locked requirements

The TradeNest Technical Blueprint requires JWT access tokens, refresh sessions, bcrypt password hashing, RBAC identity, hashed refresh tokens, rotation, per-session/global revocation, public Buyer/Seller registration, no public Admin registration, and rejection of suspended/banned users.

## Decisions

1. Access tokens are HS256 JWTs signed by the NestJS API using `jose`.
2. Access JWTs contain only the authenticated user id (`sub`), session id (`sid`), role, standard issuer/audience timestamps and a random `jti`.
3. Refresh tokens are opaque high-entropy credentials. The token is `<session UUID>.<256-bit random secret>` so the server can locate a session without storing the secret itself.
4. Only SHA-256 of the complete refresh token is stored. SHA-256 is appropriate here because the source token is randomly generated high entropy; bcrypt remains mandatory for human passwords.
5. Refresh rotation atomically updates the expected old hash to the new hash. A reused old token fails after rotation.
6. Access authentication rechecks session revocation/expiry and current user status, so logout and suspension take effect even before a short-lived JWT expires.
7. Password change revokes all current refresh sessions.
8. Default TTLs are 15 minutes for access and 30 days for refresh, configurable through validated environment variables.
9. Public registration allows only BUYER or SELLER. The contract excludes ADMIN and service logic contains a defense-in-depth rejection.

## Non-decisions

This ADR does not define email verification, MFA, password reset, external identity providers, device fingerprinting, or admin account provisioning because the blueprint does not specify them.
