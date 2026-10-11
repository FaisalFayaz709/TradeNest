# TradeNest Seller intelligence — AI Integration and Seller Intelligence

## Locked design preserved

Next.js 16 + React + TypeScript, Tailwind/shadcn UI, Node 24 LTS + NestJS modular monolith, PostgreSQL 18 + Prisma 7, Zod 4, JWT/bcrypt/RBAC, and internal Python/FastAPI + scikit-learn/pandas/NumPy remain mandatory. Browser traffic reaches AI **only through NestJS**. AI does not set payment success, product prices, financial state, or escrow. The original 74 blueprint endpoints remain unchanged.

## Implemented after reviewing actual source

- **Purchase signal integrity:** the optional-authenticated `POST /api/v1/events` still accepts views, cart additions and wishlists, but now refuses browser-submitted `PURCHASE` with HTTP 403. `PURCHASE` behavior is derived from successful provider-verified payment records and excludes refunded/cancelled orders. Previously saved client-supplied `PURCHASE` rows are ignored in the recommendation feed. Read-only query avoids making Analytics write Orders/Payments tables or creating a new inter-module mutation dependency.
- **Recommendation reliability:** NestJS returns deterministic eligible-catalog recommendations for no activity, no model results, or an internal AI HTTP 502/503. The response is explicitly labeled `catalog-fallback-v1`, never disguised as personalized ML. Other errors still propagate. AI pricing and fraud-risk remain separate; their failures cannot silently change authoritative state.
- **Catalog accuracy:** only ACTIVE listings from eligible sellers with available inventory become recommendation candidates. Catalog remains the owner of product eligibility decisions.
- **Buyer UX:** the marketplace home now displays buyer-only recommendations, resolves product IDs against the public active catalog and displays backend-provided current prices, never AI-generated prices. Product-card cart/wishlist actions send best-effort behavior events only after successful action requests.
- **Seller UX:** fixed the seller AI-insights action's missing `jsonData` import and the Next.js API proxy allowlist for `seller/analytics/overview` and `/revenue`. No new HTTP route was created.
- **Testing:** executable Node fallback tests, NestJS unit tests, FastAPI route/model HTTP tests, architecture/source guards, CI job, and fail-closed acceptance runner.

## Data / behavior boundaries

- Legacy user-event `PURCHASE` rows are intentionally ignored. Verified purchase read projections are tied to signed-provider successful payment state. The SQL query uses owner-scoped orders, excludes fully refunded/cancelled orders, and caps rows.
- Purchase signals are generated from paid orders rather than inserted as unverified client behavior. A refund removes the order from the purchase read projection at the next retrieval.
- Catalog fallback ranks recently listed eligible products; similar-product fallback groups by category. It is deliberately *not* a trained model and does not claim preference accuracy.
- Optional AI failure cannot prevent core commerce or fabricate payment state. Failure of a pricing API still surfaces as a failure rather than inventing a price range.
- Seller revenue, AOV and escrow data remain independent from model suggestions and grouped by currency.

## Mandatory acceptance in a real locked environment

1. Complete the earlier Foundation `pnpm-lock.yaml` review and frozen install with Node 24, pnpm 10.15.1, PostgreSQL 18, Docker Compose and an isolated `tradenest_seller_ai_test` database.
2. Run `pnpm verify:seller-intelligence` and `python -m pytest -q services/ai/tests`.
3. Run `pnpm acceptance:seller-intelligence` including cumulative prerequisite test suites, Prisma generation/validation, full TS compilation, Jest (including Seller intelligence unit tests), the database tests, actual NestJS+FastAPI calls, and Playwright. Execute `pnpm --filter @tradenest/api verify:seller-intelligence:ai` only against a localhost PostgreSQL 18 `*_test` database; the script tests spoofed, verified, and refunded purchase signals.
4. In an isolated provider sandbox, test signed successful/failed payments and verify `PURCHASE` events cannot be spoofed, a refunded order no longer contributes purchase history, recommendations ignore inactive/suspended/stockless products, and cold start/unavailable AI still returns eligible products without altering checkout.
5. Confirm seller KPIs against seeded fixtures and that pricing advice cannot modify listing prices.

**Not signed off:** This archive was prepared without Node 24, pnpm, a legitimate pnpm lockfile, PostgreSQL 18, S3 or live Stripe test credentials. Source checks and Python tests are real, but a complete application build or live database transaction has **not** been verified here. Do not deploy or claim zero-deviation production certification without those acceptance results.
