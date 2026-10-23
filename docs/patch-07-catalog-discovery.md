# TradeNest Patch 07 — catalog discovery and product cards

## Scope

- Marketplace Explore uses a URL-driven, accessible GET form for keyword and category filtering. Both filters are sent through existing `q` and `categoryId` public API parameters, without client-side fabricated results or unsupported sort controls.
- Existing `catalog-grid.tsx` stays untouched to preserve previously applied local hook/lifecycle repairs and API-backed pagination. Mobile-specific pagination controls can be adjusted separately against the current file.
- Search preserves direct links and makes it easy to browse the complete catalog when the query is empty.
- Categories improve loading/unmounted request safety, empty states, subcategory navigation and mobile layouts.
- Product cards improve responsive readability, image placeholders, keyboard focus, stock availability cues, and buyer action touch targets. They use Next.js `Image` without unrestricted remote-host optimization (until specific upload hosts are configured).
- Backend cart and wishlist mutations, analytics events, SKU/prices, authentication checks, and financial workflow behavior are unchanged.

## Compatibility repair

This adjusted patch excludes `apps/web/components/catalog-grid.tsx` because the original Patch 07 depended on old lines that are no longer present after local lint repairs. All other catalog discovery changes remain.

## Verification on the target Mac

1. `git apply --check ~/Downloads/TradeNest_Patch_07_1_Catalog_Discovery_Compatible.patch`
2. `git apply ~/Downloads/TradeNest_Patch_07_1_Catalog_Discovery_Compatible.patch`
3. `node --test scripts/tests/ui-catalog-discovery.test.mjs scripts/tests/ui-home-commerce.test.mjs scripts/tests/ui-interaction-links.test.mjs`
4. `pnpm --filter @tradenest/web typecheck`
5. `pnpm --filter @tradenest/web exec eslint components/catalog-grid.tsx components/catalog-toolbar.tsx components/product-card.tsx app/explore/page.tsx app/explore/explore-query.tsx app/search/search-client.tsx app/categories/page.tsx`

## Browser smoke checks

- On 375px, 768px and desktop widths visit `/`, `/explore`, `/categories`, and `/search?q=term`.
- Use the Explore keyword + category form together; verify URL and API results stay aligned and Clear filters removes both.
- Open a product card and use keyboard Tab / Enter; check image placeholder on products without photos.
- With a buyer session, test add-to-cart and wishlist success/error notifications; with no session, confirm a sign-in message, not a fictitious success.
- Verify out-of-stock products cannot be added to cart from cards.

Full-browser QA is still required: source/static checks do not prove real API or pixel-layout behavior.
