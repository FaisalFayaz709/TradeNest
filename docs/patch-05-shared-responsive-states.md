# Patch 05 — Shared responsive states & content layout

Scope: Next.js UI only. No API, payment, escrow, role, or domain logic was changed.

- `LoadingState`: named, screen-reader-announced status; hidden decorative spinner; readable on narrow screens.
- `ErrorNotice`: preserves alert semantics and wraps long error details instead of forcing horizontal scrolling.
- `EmptyState`: smaller phone padding, stronger visual hierarchy, icon hidden from screen readers, and full-width primary action on narrow screens.
- `PageShell`: 320px-friendly gutters and a later (large-screen) breakpoint for side-by-side headings/actions.
- `TableScroll`: single reusable labelled, keyboard-focusable horizontal scrolling region. Used by Admin Products and Admin Users tables without hiding columns or moderation actions.

Check with:

```bash
node --test scripts/tests/ui-shared-responsive-states.test.mjs
pnpm --filter @tradenest/web typecheck
pnpm --filter @tradenest/web exec eslint components/page-shell.tsx components/loading-state.tsx components/error-notice.tsx components/empty-state.tsx components/table-scroll.tsx app/admin/products/page.tsx app/admin/users/page.tsx
```

Manual browser acceptance: test 320px, 375px, 768px, 1024px, and 1440px viewports; test the admin tables with keyboard focus and horizontal arrows; test 200% zoom and long backend errors. Remaining whole-project ESLint findings predate Patch 05 and are tracked separately.
