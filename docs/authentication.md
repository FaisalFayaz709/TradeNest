# TradeNest Authentication

## Public endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Create a Buyer/Seller account and initial session |
| POST | `/api/v1/auth/login` | Authenticate an active user and create a session |
| POST | `/api/v1/auth/refresh` | Rotate the current refresh token and issue a new access JWT |

## Authenticated endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/logout` | Revoke the current refresh session |
| POST | `/api/v1/auth/logout-all` | Revoke all refresh sessions for the current user |
| GET | `/api/v1/auth/me` | Return the authenticated identity |
| POST | `/api/v1/auth/change-password` | Verify current password, replace its bcrypt hash, revoke active sessions |

Authenticated calls use `Authorization: Bearer <access-token>`.

## Registration flow

`Zod -> normalize email -> bcrypt -> transaction(create user + session) -> JWT + refresh token`

The database UNIQUE constraint remains the race-safe email integrity boundary. Public Admin registration is denied both by the shared Zod contract and backend service logic.

## Login flow

`Zod -> find user -> bcrypt compare -> ACTIVE status -> create session -> issue tokens`

`SUSPENDED` and `BANNED` users fail authentication even with the correct password.

## Refresh flow

`parse session id -> load session/user -> verify stored token hash -> ACTIVE account -> compare-and-rotate token hash -> issue JWT`

The compare-and-rotate database update prevents two concurrent uses of the same refresh token from both succeeding.

## Password storage

Only bcrypt password hashes are stored. Password hashes are never included in API response DTOs.

## Refresh storage

Only the SHA-256 token hash is stored in `user_sessions.refresh_token_hash`; the raw refresh token is returned once to the client. Sessions include expiry, revocation, IP and user-agent metadata as already defined by the database blueprint.
