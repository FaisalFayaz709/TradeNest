# TradeNest Patch 04 — Seller / Admin responsive workspace navigation

## Scope

- Shares navigation markup and responsive behavior between the existing SellerShell and AdminShell.
- Uses an in-flow, native `<details>` / `<summary>` disclosure below 1280 CSS px instead of rendering all 10–11 sidebar links above workspace content.
- Adds scroll containment for short/mobile viewports, current-section indicator, keyboard Escape close, and focus return to the summary.
- Shows a persistent sticky navigation rail at `xl` and above. All seller and admin route hrefs are unchanged.
- Tightens mobile page padding, heading wrapping and content `min-w-0` handling, without rewriting individual seller/admin pages.

## Explicitly unchanged

- SellerGate and AdminGate role checks.
- NestJS API routes, authorization, payments, refunds, escrow, ledger, disputes, and seller ownership rules.
- Navigation route destinations and dashboard content.
- Desktop public site header from Patch 03.

## Checks

```sh
node --test scripts/tests/ui-workspace-responsive.test.mjs scripts/tests/ui-header-responsive.test.mjs
pnpm --filter @tradenest/web typecheck
pnpm --filter @tradenest/web exec eslint components/workspace-nav.tsx components/seller/seller-shell.tsx components/admin/admin-shell.tsx
```

Manual browser review still required: signed-in seller and admin accounts at widths 320, 375, 430, 768, 820, 1024, 1280 and 1440 px; short viewport, Escape, current-route selection, keyboard tabbing, long titles, and at 200% zoom. The static test is not a substitute for this check.
