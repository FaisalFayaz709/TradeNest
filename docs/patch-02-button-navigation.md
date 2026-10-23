# Patch 02 — Navigation buttons and link semantics

## Scope

Eliminates 18 invalid `Next.js <Link><Button>...</Button></Link>` combinations across 11 web files. The existing TradeNest `Button` component already implements shadcn/ui `asChild` using Radix Slot. It is now used as `<Button asChild><Link href="...">...</Link></Button>` so the result is a **single anchor** styled as a button rather than an anchor wrapping a button.

## Why it matters

- Avoids nested interactive elements, which cause accessibility and keyboard/navigation problems.
- Preserves existing destinations and button variants, including login, marketplace exploration, checkout, payment status, account and seller navigation.
- Preserves cart checkout button's `mt-5 w-full` classes on the actual clickable link.
- Retains TradeNest branding through `buttonVariants`; no new palette, dependencies, backend routes or business rules.

## Verify on your Mac

```sh
# From TradeNest-github
node --test scripts/tests/ui-interaction-links.test.mjs
pnpm --filter @tradenest/web typecheck
pnpm --filter @tradenest/web exec eslint   'app/cart/page.tsx' 'components/site-header.tsx' 'components/buyer-gate.tsx'
pnpm --filter @tradenest/web build
```

The ESLint command may report unrelated pre-existing React Hook errors in `app/cart/page.tsx`; those are a different Patch 01.1 cleanup, not a failure of button-link semantics. Existing lint issues are **not** hidden or waived by this patch. If the production build fails for unrelated environment issues, report the exact error.

## Manual acceptance checklist

- Navigate via keyboard Tab + Enter in the header (signed in and out).
- Verify Sign in and Create account from buyer/seller/admin access gates.
- Navigate to checkout from a populated cart; confirm single, full-width CTA on narrow devices.
- Follow order/payment links after checkout; ensure the backend still determines financial status.
- Check the CTA appearance at 320, 375, 768, 1024 and 1440 CSS px (responsive browser testing still pending).

## Not included

Patch 03 will handle the header's tablet breakpoints and mobile menu layout. Patch 04 will handle workspace navigation. Patch 02 deliberately fixes invalid link/button composition only, without touching sensitive payment or authentication APIs.
