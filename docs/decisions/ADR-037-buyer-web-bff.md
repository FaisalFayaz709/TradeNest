# ADR-037 — Buyer Web BFF and HttpOnly Session Boundary

## Status

Accepted for this decision.

## Context

The blueprint locks Next.js as the UX layer and NestJS as business/financial authority. The existing authentication API returns JWT access tokens and rotating refresh sessions. A production Buyer UI needs authenticated browser navigation without putting reusable refresh credentials in JavaScript-accessible storage or turning Next.js into a second business backend.

## Decision

Use a narrow Next.js Backend-for-Frontend boundary for the Public/Buyer web application.

- Access and refresh tokens are stored in `HttpOnly`, `SameSite=Lax` cookies owned by same-origin Next.js session route handlers.
- Browser components call same-origin `/api/tradenest/...` routes.
- The BFF contains an explicit Public/Buyer allowlist and forwards only approved API paths/methods to NestJS.
- Seller/Admin paths are not exposed by this proxy.
- Token refresh/rotation occurs server-side and retries the original eligible request once.
- Idempotency and request-correlation headers are preserved.
- No domain/financial decision is reimplemented in Next.js.
- The server-side NestJS destination is `TRADENEST_API_INTERNAL_URL`.

## Consequences

Positive:

- reusable authentication tokens are not exposed to browser JavaScript;
- the browser has a same-origin API surface;
- NestJS remains the only marketplace authority;
- the allowlist limits accidental privilege expansion;
- container deployment can use an internal API hostname without exposing that hostname to clients.

Trade-offs:

- Next.js route handlers become part of the authentication transport path and require security review;
- CSRF assumptions depend on same-origin requests and `SameSite=Lax`; any future cross-site embedding/API requirement must revisit this boundary explicitly;
- horizontal/web-edge deployment must preserve secure cookie and internal API configuration correctly.

## Rejected alternatives

- Store refresh/access tokens in `localStorage`: rejected because reusable credentials become JavaScript-accessible.
- Let browser components call FastAPI directly: forbidden by the blueprint AI boundary.
- Put marketplace business rules in Next.js server actions/route handlers: forbidden because NestJS owns business and financial truth.
- Build an unrestricted reverse proxy: rejected because it would unnecessarily expose Seller/Admin/backend surfaces through the Buyer application.
