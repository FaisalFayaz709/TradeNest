# Patch 01.1B — Seller catalog and dashboard effect cleanup

This is **part of** Patch 01.1 lint stabilization, not completion of the full frontend lint backlog.

## Changed files

- `apps/web/app/seller/products/page.tsx`
  - Initial product/category loading is now asynchronous inside the effect with an unmount guard.
  - Product/category manual `load()` refresh after a product operation is unchanged.
  - Create Product uses a **derived effective category** instead of a state-setting effect. The selected category is still submitted to the same endpoint.
- `apps/web/app/seller/page.tsx`
  - Initial dashboard request and optional analytics request now use guarded async result handlers.
  - Onboarding/manual refresh and the backend API endpoints remain unchanged.

No payment, escrow, auth, pricing, or inventory backend functionality is modified.

## Apply

```sh
git apply --check ~/Downloads/TradeNest_Patch_01_1B_Seller_Catalog_Dashboard.patch
git apply ~/Downloads/TradeNest_Patch_01_1B_Seller_Catalog_Dashboard.patch
```

## Verify

```sh
pnpm --filter @tradenest/web exec eslint app/seller/products/page.tsx app/seller/page.tsx
pnpm --filter @tradenest/web typecheck
```

## Manual acceptance (with local/test data)

1. Visit seller dashboard with a seeded seller: profile loads; analytics appear if available.
2. Visit seller dashboard without a seller profile: onboarding form appears; onboarding then refreshes the dashboard.
3. Visit seller products: product list and categories load; choose a category and create a draft; check the saved category.
4. Publish/archive a test product; product list refreshes after the action.
5. Navigate away while requests are in-flight, then return: no stale data should appear.
6. Confirm that loading and API failure messages are sensible.

### Limitations

This patch was checked against the supplied ZIP and patch sequence. Runtime/browser testing and full ESLint verification must be completed in your local Node.js 24 workspace before merging. Do not test moderation, orders, or financial workflows against production accounts.
