# Patch 11 — Frontend lint cleanup

Scope: remaining two React Hook effect errors and three minor warnings after Patch 10.

- Admin dispute detail: loading effect is cancellation-safe; route changes remount the detail, and action idempotency and existing backend resolution endpoints are preserved. Loading failures display an error instead of an infinite spinner.
- Notifications: initial fetch uses asynchronous state updates, and keyed account content prevents one buyer's notification list appearing in a different buyer's session. Read/read-all routes are unchanged.
- Wishlist: images use the established `next/image` unoptimized external-image rendering convention with a sized, positioned container.
- Seller AI insights: unused import removed; pricing actions remain advisory.
- PostCSS: named config export object, no change in plugins.

No backend schema, ledger, escrow, payment, or auth changes. `next/image` is used with `unoptimized` for dynamically sourced remote seller image URLs, matching the existing card and gallery implementation; this removes the lint warning but does **not** provide Next.js image optimization.

Run the full frontend lint/typecheck and browser smoke tests on Node 24 with pnpm 10.15.1.
