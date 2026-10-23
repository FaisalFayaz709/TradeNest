# Patch 01.1D — Buyer profile and wishlist loading stabilization

## Purpose

This is the next incremental step in the frontend ESLint cleanup after Patch 01.1C. It is **not** the entire remaining lint backlog and does not begin the visual UI redesign (Patch 02).

## Files changed

- `apps/web/app/profile/page.tsx`
  - Initial profile and address fetching is performed asynchronously inside `useEffect` without synchronously invoking a state-updating loader.
  - The profile name and addresses are updated together after both requests resolve.
  - Late results are ignored after the component unmounts.
  - Existing manual `load()` refresh after address creation/deletion is retained.
  - Password change, account logout, and backend ownership rules are unchanged.
- `apps/web/app/wishlist/page.tsx`
  - Initial wishlist fetch and active-product resolution happen asynchronously with unmount guards.
  - Products and saved items update together after both lookups resolve.
  - The existing manual `load()` refresh after removal is retained.
  - Add-to-cart requests and backend validation are unchanged.

## Apply (from `TradeNest-github`)

```sh
git apply --check ~/Downloads/TradeNest_Patch_01_1D_Buyer_Account_Loading.patch
git apply ~/Downloads/TradeNest_Patch_01_1D_Buyer_Account_Loading.patch
```

## Targeted checks on your Mac

```sh
pnpm --filter @tradenest/web exec eslint app/profile/page.tsx app/wishlist/page.tsx
pnpm --filter @tradenest/web typecheck
```

Wishlist currently has an `@next/next/no-img-element` **warning** that this patch intentionally does not address; it is reserved for the later image/visual optimization patch. A lint command may therefore exit successfully while printing that warning.

## Manual acceptance required

1. Sign in as a Buyer and load Profile. Confirm name and shipping addresses display without an infinite loading state.
2. Add, edit, and delete an address; confirm refresh still shows the new state.
3. Check password change/logout controls in an isolated development test account.
4. Open Wishlist with saved products. Remove a product, and add an in-stock product to cart.
5. Trigger a failed profile/wishlist request; verify an error notice appears rather than an endless spinner.
6. Navigate away during a slow request and ensure stale content does not appear on another page.
7. Test mobile/tablet/desktop layouts in the later responsive E2E acceptance phase.

## Safety and verification limitations

The patch changes initial React data-loading behavior only. It does not change the NestJS backend, product pricing, payment handling, or escrow rules. Git applicability and TypeScript parsing were checked against the supplied source; full ESLint, typecheck, running application, and browser behavior still require local verification.
