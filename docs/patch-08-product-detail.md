# Patch 08 — Responsive Product Detail & Purchase Experience

Changes only the buyer-facing product detail page and a new gallery component. It does not modify backend routes, payment/escrow logic, or catalog storage.

## What changed

- Replaces the decorative five-image strip with a scrollable, interactive, keyboard-operable gallery. Thumbnails are buttons with `aria-pressed`, primary imagery is preferred, images use their API `sortOrder`, and a missing-photo placeholder is provided.
- Uses `next/image` with `unoptimized` for seller-hosted media. TradeNest has not yet allow-listed and validated every seller media host for the Next.js image optimizer; this patch does **not** introduce an unrestricted optimization proxy.
- Reworks narrow-screen layout with full-width purchase and save actions, a stock-bounded quantity input and stepper buttons, and readable descriptions and reviews.
- Fixes the legacy synchronous-setState-in-effect lint violation. A slug-keyed content component and cancellation flags prevent stale product/review/recommendation responses from changing the new route's UI.
- Adds a busy state to prevent duplicate cart/wishlist actions; the existing Buyer gate, API routes and events are unchanged.
- Distinguishes reviews still loading or unavailable from a genuine zero-review result. Recommendations continue to use real API data, not fabricated merchandise.

## Verification

```sh
node --test scripts/tests/ui-product-detail.test.mjs
pnpm --filter @tradenest/web typecheck
pnpm --filter @tradenest/web exec eslint 'app/products/[slug]/product-detail-client.tsx' components/product-gallery.tsx
```

Manually exercise product galleries (0, 1, many photos), keyboard thumbnail selection, mobile quantity stepper, unavailable stock, buyer and guest actions, navigating rapidly between product routes, and slow/failing reviews. Backend cart, pricing and inventory remain authoritative.
