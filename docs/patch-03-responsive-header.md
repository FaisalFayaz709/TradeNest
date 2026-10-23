# Patch 03 — Responsive header and navigation

## Blueprint alignment

Preserves the TradeNest navy (#0B2A4A) brand, teal active-navigation treatment, gold Admin account accent and responsive Next.js/Tailwind design (§4 of the Technical Blueprint). No changes to backend identity, business policy, checkout or escrow.

## UI changes

- Full desktop navigation activates at **xl (1280px)** rather than md (768px), avoiding cramped tablet layouts for authenticated buyers.
- Phone/tablet header keeps Search visible; a buyer also has a direct Cart shortcut even when the menu is collapsed.
- Mobile/tablet drawer has a maximum viewport-relative height, independent vertical scrolling and readable Browse/Account sections.
- Current-page navigation links get `aria-current="page"`, a consistent active state and visible keyboard focus.
- Escape closes the drawer and restores focus to its toggle; tapping outside closes the drawer; route changes reset open state.
- Maintains single-link `Button asChild` composition introduced in Patch 02.

## Verification on your Mac

```sh
# In TradeNest-github, after applying Patch 03
node --test scripts/tests/ui-header-responsive.test.mjs scripts/tests/ui-interaction-links.test.mjs
pnpm --filter @tradenest/web exec eslint components/site-header.tsx e2e/frontend-frontend-accessibility.spec.ts
pnpm --filter @tradenest/web typecheck
pnpm --filter @tradenest/web build
```

The full frontend lint run will continue to show unrelated pre-existing React Hook errors from other screens until the follow-up lint-stabilization patches are complete.

For Playwright, set up the project's **isolated E2E database** as documented in the repository and use the normal frontend E2E command; the test suite runs at 320, 375, 430, 768, 820, 1024, 1279, 1280 and 1440 CSS pixels, plus an Escape-key test. Do not connect E2E tests to production data.

## Manual acceptance

- Verify at 320px and 375px with the menu both open and closed; no horizontal clipping.
- Sign in as Buyer: Search, Cart, Notifications, Profile, Sign out accessible from small and wide layouts.
- Sign in as Seller or Admin: workspace links accessible and readable at tablet sizes.
- Use keyboard Tab/Shift+Tab, Enter and Escape; focus returns to the drawer toggle.
- Open the mobile drawer, then change routes and use browser back/forward. The drawer should not remain open on the previous route.
- On desktop, verify long user names truncate instead of forcing header overflow.

## Not included

Seller/Admin workspace sidebars (Patch 04), individual page overflow issues, and remaining existing React lint failures are separate work. A clean TypeScript check is not proof of live browser accessibility or multi-device acceptance.
