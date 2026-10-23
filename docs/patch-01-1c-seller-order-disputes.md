# Patch 01.1C — Seller order and dispute loading stabilization

## Scope

This is an incremental lint-stabilization patch, not the completion of Patch 01.1 or the responsive UI redesign.

- `apps/web/app/seller/orders/[id]/seller-order-detail-client.tsx`
  - Initial order loading no longer calls a synchronous state-setting function from `useEffect`.
  - Escrow and shipment are still fetched independently, so an absent optional record does not block the order page.
  - Unmount guards prevent initial requests from updating an unmounted component.
  - Order detail is keyed by the route ID to avoid displaying the previous order when navigating between IDs.
  - Manual refresh after creating a shipment remains on the existing `load()` path.
- `apps/web/app/seller/disputes/[id]/seller-dispute-detail-client.tsx`
  - Initial dispute loading is asynchronous inside `useEffect`, with an unmount guard.
  - Route-ID keyed detail resets its local state when navigating to another dispute.
  - Manual refresh after posting a message or evidence remains intact.

No modifications to NestJS, checkout, payment, escrow, shipment commands, or dispute authorization.

## Apply from the repository root

```sh
git apply --check ~/Downloads/TradeNest_Patch_01_1C_Seller_Order_Disputes.patch
git apply ~/Downloads/TradeNest_Patch_01_1C_Seller_Order_Disputes.patch
```

## Static verification (Mac with workspace dependencies installed)

```sh
pnpm --filter @tradenest/web exec eslint   'app/seller/orders/[id]/seller-order-detail-client.tsx'   'app/seller/disputes/[id]/seller-dispute-detail-client.tsx'
pnpm --filter @tradenest/web typecheck
```

> Quote the square-bracket file paths: they are route names, not shell glob expressions.

## Required manual acceptance with isolated development data

1. Seller order detail loads for a permitted order ID. Creating a shipment still refreshes the order and shipment status.
2. Order without escrow or shipment still displays its order details instead of a permanent loading indicator.
3. Seller dispute detail loads messages and evidence. Posting a message and uploading evidence still refreshes the record.
4. Navigate between different order IDs or dispute IDs: prior record details should not remain visible.
5. Navigate away during a slow API request: no stale page update should occur.
6. Check failure states with intentionally invalid IDs; errors should be shown rather than infinite loading.
7. Check these screens at phone, tablet, and desktop sizes in a later browser acceptance pass.

## Verification limits

This patch has been checked for Git application and TypeScript syntax parsing against the uploaded repository and previous patch sequence. Run ESLint, typecheck, and browser tests locally before merging. Passing those checks does not prove the financial workflows are production-ready.
