# Buyer Frontend

The runtime Next.js application implements the blueprint's Public/Buyer application family while preserving NestJS as the marketplace authority.

## Delivered page family

Public:

- `/` — Home
- `/explore` — pageable/filterable catalog discovery
- `/categories` — category browsing
- `/search` — product search
- `/products/[slug]` — product detail, reviews, similar products, cart/wishlist actions
- `/auth/login` — Buyer sign-in
- `/auth/register` — Buyer registration only

Authenticated Buyer:

- `/cart`
- `/checkout`
- `/orders`
- `/orders/[id]`
- `/wishlist`
- `/profile`
- `/payments`

## Browser/server authentication boundary

The browser does not store JWT access or refresh tokens. Login/registration responses are terminated by same-origin Next.js route handlers, which place the access/refresh tokens in `HttpOnly`, `SameSite=Lax` cookies. Browser code calls the same-origin `/api/tradenest/...` BFF surface.

The BFF:

1. uses an explicit Public/Buyer path allowlist rather than becoming an arbitrary proxy;
2. attaches the server-held access token to NestJS;
3. rotates the refresh session server-side after an eligible backend `401`;
4. preserves idempotency/request-correlation headers where needed;
5. never exposes Seller/Admin routes through the Buyer proxy.

`TRADENEST_API_INTERNAL_URL` is the server-only NestJS target. The deployment reference sets it to `http://api:4000/api/v1` while browser traffic stays same-origin to Next.js.

## Commerce authority

The UI never submits trusted product prices, subtotals, discounts, shipping totals, order totals, payment-success state, escrow state, inventory state, or arbitrary order statuses.

- Cart totals shown before checkout are clearly marked as estimates.
- `/checkout` requests `POST /checkout/quote` and renders the backend-authoritative quote.
- The quote's `inventoryReserved` value is displayed; a quote does not create browser-side reservation authority.
- `POST /checkout` submits the selected shipping address plus a stable `Idempotency-Key`, not trusted money values.
- Payment initiation calls the existing payment command with a stable idempotency key. The UI stays pending until verified provider/backend state changes the payment record.
- Delivery confirmation, cancellation, dispute creation, and reviews are command calls; the backend remains free to reject them according to its state machines/policies.

## Buyer lifecycle UX

Order detail combines the existing order, shipment, and escrow read models. Action visibility follows the implemented backend rules:

- payment initiation while `PENDING_PAYMENT`;
- cancellation while `PENDING_PAYMENT`;
- dispute creation while `PAID`, `PROCESSING`, or `SHIPPED`;
- delivery confirmation while `SHIPPED`;
- verified-purchase review submission after `COMPLETED`.

The UI does not mutate status directly.

## Product intelligence integration

Product detail uses the public product/review APIs, records permitted behavior events through NestJS, and loads similar-product recommendations through the existing NestJS AI bridge. The browser does not contact FastAPI.

## Payments page limitation

The current blueprint/API implementation exposes `GET /payments/:id` but does not define a Buyer-wide payment-list endpoint. This capability therefore provides exact payment-ID lookup and keeps only recently viewed/created payment **IDs** in browser local storage. No token, email, payment result, or other authentication secret is persisted there.

## Scope boundaries

Seller and Admin page families are implemented separately and documented in `docs/seller-frontend.md` and `docs/admin-frontend.md`; the Buyer surface does not inherit their authorities.

It also does not invent undefined product requirements such as tax rules, shipping-carrier checkout, provider-hosted payment UI, email-change verification, or new financial endpoints.
