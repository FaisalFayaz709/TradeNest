# Authentication contracts

This contract surface implements the transport contracts needed for the blueprint's authentication endpoints.

## Blueprint-locked behavior

- Public registration creates a Buyer/Seller-capable account; `ADMIN` is never publicly registerable.
- Login authenticates an existing active account.
- Refresh rotates a refresh session and access token.
- Logout revokes the current session; logout-all revokes all refresh sessions for the user.
- `/auth/me` returns current identity.
- Password change is authenticated.

## implementation decisions

The blueprint does not specify exact request fields or password policy. This contract surface uses `name`, `email`, `password`, and an optional `BUYER | SELLER` role for registration; login uses email/password. Passwords are at least 8 characters and capped at bcrypt's 72-byte input boundary. These are implementation decisions and may be changed only if the resulting behavior remains compatible with the locked blueprint.
