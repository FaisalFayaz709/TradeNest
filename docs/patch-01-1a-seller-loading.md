# Patch 01.1A — Seller initial-load lint stability

## Scope

- `apps/web/app/seller/inventory/page.tsx`
- `apps/web/app/seller/settings/page.tsx`

Initial data fetching now starts in effects without synchronously calling a state-setting `load()` function. Async completions are ignored after unmount. The existing manual refresh functions, stock-save flow, and account security endpoints remain unchanged.

This patch does **not** claim to fix every remaining frontend ESLint error. It is the first incremental batch of Patch 01.1.

## Verify after applying

```sh
pnpm --filter @tradenest/web exec eslint app/seller/inventory/page.tsx app/seller/settings/page.tsx
pnpm --filter @tradenest/web typecheck
```

## Browser acceptance still required

With a valid seller session: load Inventory and Settings; edit inventory; update store name; confirm the lists refresh and error/loading states behave correctly. Repeat navigation away during loading to check no stale update. Do not test destructive/financial operations against a production account.
