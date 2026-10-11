# AuthModule

AuthModule owns authentication and refresh-session behavior.

## Locked blueprint behavior implemented

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/change-password`
- JWT Bearer access tokens.
- bcrypt password hashing.
- Refresh-token hashes only in `user_sessions`.
- Refresh-token rotation and per-session/global revocation.
- Suspended/banned accounts cannot authenticate.
- `ADMIN` cannot be publicly registered.

## Boundary rule

Controllers call `AuthService`; only `AuthRepository` may touch Prisma. Other business modules must import authentication capabilities through `auth/public/`.

## implementation decisions

- HS256 access JWTs using `jose`.
- 15-minute access-token TTL and 30-day refresh-token TTL by default, both configurable.
- Opaque 256-bit refresh-token secret with the session UUID as a lookup prefix; only SHA-256 of the complete token is stored.
- Password change revokes all active refresh sessions, requiring re-authentication.
- Registration contract fields and minimum password length are implementation decisions because the blueprint does not define them.
