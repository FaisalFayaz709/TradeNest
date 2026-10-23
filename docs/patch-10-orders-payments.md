# Patch 10 — Buyer orders and payment status

## Scope

This is a **frontend-only** presentation and lifecycle patch. It changes:

- The buyer orders list to use paginated `orders?page=N&limit=12` backend reads with Prev/Next navigation, cancellation-safe loading and a functional retry action.
- The buyer order detail to show a mobile-friendly status timeline derived entirely from the backend `order.status`, separate shipment/escrow read models, and clearer provider-return messaging. It remounts on order-ID changes and guards initial async loads.
- The buyer payments page to scope remembered payment IDs and viewed payment results to the current buyer, improve mobile readability and let buyers open the related order.

## Unchanged financial and security behavior

- The existing buyer access gate remains in place. Server-enforced permissions still control order/payment lookups.
- Payment initiation still calls `POST orders/:id/payments` with an idempotency key and uses `hostedCheckoutRedirect`.
- Delivery confirmation still calls `POST orders/:id/confirm-delivery` with an idempotency key.
- Cancellation, reviews, disputes and managed-file evidence keep their existing backend endpoints and validations.
- A provider return **never** changes the payment, order, or escrow state locally. Payment status is read from the existing API; the backend verifies provider webhooks.

## Validation

Run from repository root using Node.js 24:

```sh
node --test scripts/tests/ui-orders-payment-status.test.mjs
pnpm --filter @tradenest/web typecheck
pnpm --filter @tradenest/web exec eslint \
  app/orders/page.tsx \
  'app/orders/[id]/order-detail-client.tsx' \
  app/payments/page.tsx
```

Manual QA should cover at least phone, tablet and desktop widths, different order statuses, order pagination, gateway return `?payment=...`, buyer switch/logout, and errors from read-only API requests. Automated source tests do not replace real browser and payment-provider sandbox testing.
