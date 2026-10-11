# TradeNest — Frontend: Frontend Completion and UI Integration

**Status: source implementation and dependency-free tests delivered; runtime acceptance NOT CERTIFIED.**

## Baseline and locked boundaries

This pass continues the cumulative Seller intelligence archive. It preserves `SPEC_LOCK.yaml`, the original 21-page blueprint, all historical Prisma migrations, the existing 74 required API routes, the NestJS modular-monolith module boundaries, FastAPI's internal-only role, and the designated Next.js 16 / React / TypeScript / Tailwind CSS / shadcn/ui frontend stack. No new public NestJS endpoints were created.

## Independently identified functional gaps and corrections

1. The Next.js same-origin `/api/tradenest/[...path]` allowlist did not include several APIs that existing screens had called in the storage, admin, and notifications capabilities. Added explicit **method-scoped and UUID-scoped** allowlist rules for managed product image uploads, private dispute evidence uploads, the six admin moderation actions, and the four notifications routes. No catch-all proxy was introduced.
2. The public product-image route existed in the API and the web route had a binary-response branch, but the allowlist blocked it before that branch could run. The route is now allowed for GET only; image bytes are streamed with content type, `nosniff`, and the backend's public-object eligibility check. Rotated credentials are handled by a NextResponse.
3. Checkout's new-payment path ignored Stripe's `checkoutUrl`. It now redirects only to a validated HTTPS `checkout.stripe.com` origin (the same security rule as the order-detail payment path) and never marks a payment successful in the browser. Sandbox payments do not redirect.
4. The recent-payments browser list was device-global. It is now keyed by the authenticated buyer ID so switching accounts on one browser does not show other buyers' local shortcuts; the backend remains the authoritative payment ownership verifier.
5. Account-wide sign-out now handles failed backend revocation without leaving the interface permanently disabled.
6. Product card actions now block concurrent duplicate clicks, provide status feedback, and label product images. Mobile navigation exposes `aria-expanded` and `aria-controls` semantics.

## Delivered verification

- `node scripts/verify-architecture.mjs`
- `node scripts/verify-api-contracts.mjs`
- `node scripts/verify-frontend.mjs`
- `node --experimental-strip-types --test scripts/tests/frontend-integration.test.mjs`
- Added Playwright `apps/web/e2e/frontend-frontend-accessibility.spec.ts` for Buyer, Seller, Admin and mobile navigation gates.

The new tests execute the **actual proxy allowlist regex expressions** and check allowed AND denied routes; they do not only grep for route labels. The redirect helper is executed against trusted and malicious URLs. Runtime route-to-backend success still needs real NestJS/Next.js/Stripe/S3 tests.

## Full acceptance (not run unless all prerequisites exist)

In an isolated test environment with Node 24, pnpm 10.15.1, a reviewed genuine `pnpm-lock.yaml`, PostgreSQL 18, and configured test-only external providers:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm acceptance:frontend
```

The acceptance runner is fail-closed and runs preceding suite checks before requiring TypeScript, ESLint, a Next.js production build and Playwright browser execution. Additional manual cross-browser and screen-reader review is required for release. **Prior passes are not retroactively accepted without their own runtime evidence.** Stripe live charges remain disabled under the Financial remediation/7 safety controls.
