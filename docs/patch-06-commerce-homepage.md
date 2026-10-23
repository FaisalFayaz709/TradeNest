# Patch 06 — Commerce-first homepage

The home page now leads with shopping discovery instead of payment architecture terminology. A native GET search form targets the existing `/search?q=...` page. Real active in-stock public catalog records populate the product preview, and real public category records determine category links. When an API is unavailable, the preview and category strip offer navigation without inventing products, prices, categories, or merchandising metrics.

The buyer-facing benefit strip describes only things the system is built to check; it does not promise that payment, delivery, or escrow has already completed. Seller CTA links to `/seller` (existing seller workspace) instead of Buyer registration.

The optional buyer-only recommendation section is reset by user identity with a keyed component; async completion is guarded after unmount. This resolves the existing synchronous-effect lint error in that component and prevents recommendations from the previous buyer being briefly displayed for a new buyer.

## Files

- `apps/web/app/page.tsx`
- `apps/web/components/home-market-preview.tsx` (new)
- `apps/web/components/home-categories.tsx` (new)
- `apps/web/components/personalized-recommendations.tsx`
- `scripts/tests/ui-home-commerce.test.mjs` (new)

## Verification

```sh
node --test scripts/tests/ui-home-commerce.test.mjs
pnpm --filter @tradenest/web typecheck
pnpm --filter @tradenest/web exec eslint app/page.tsx components/home-market-preview.tsx components/home-categories.tsx components/personalized-recommendations.tsx
```

## Browser acceptance

1. Test the home page at 320, 375, 768, 1024, and 1440 CSS pixels, both signed out and signed in as Buyer. Verify no horizontal overflow and readable search/form cards.
2. Search a real product name from the hero; ensure it reaches `/search?q=...` and the search page displays the query results.
3. Click a home category and confirm the existing Explore category filter is applied. Check empty category/API-down fallback without fake merchandise.
4. Click a real preview product, test one without an image, and verify currency and price match the public catalog record.
5. With a Buyer session, ensure AI suggestions load when available and do not linger after sign-out or changing users.
6. Verify Seller workspace CTA takes Seller accounts to `/seller` and does not offer public Seller role signup.

Note: This patch does not modify backend prices, stock, escrow, payments, session APIs, or external image host allowlists. Dynamic preview images use Next.js `<Image unoptimized>` until the media-host optimization policy is defined in Patch 07.
