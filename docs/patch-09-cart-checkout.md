# Patch 09 — Cart & checkout responsive experience

## Scope
- Buyer cart layout: mobile-first product rows, real catalog images, plus/minus quantity actions and a sticky desktop summary.
- Buyer checkout layout: responsive backend quote, radio-selectable addresses, order/payment status screen.
- Initial API effects now handle late responses and avoid synchronous state setters.
- Cart writes are serialized in the client, and unavailable products cannot proceed to checkout from the cart summary.

## Financial boundary (not changed)
- Browser catalog totals are **estimates only**; they never enter order-creation requests.
- The authoritative quote is still `POST checkout/quote` and does not reserve inventory.
- Order creation is still `POST checkout` with `shippingAddressId` and the original idempotency key mechanism.
- Provider payment initiation is still `POST orders/{id}/payments` with its idempotency key and `hostedCheckoutRedirect`.
- **Do not** mark a payment paid based on browser redirect or provider initiation. The verified backend provider status remains authoritative.
- No backend files or API contracts are modified.

## QA
1. At 375 px and 768 px, check cart item names/prices wrap instead of causing horizontal scrolling, and +/- work.
2. Verify unavailable and out-of-stock listings prevent checkout navigation; removal still works.
3. Confirm cart totals are labeled estimates, and checkout displays the quote's server-calculated amount.
4. Verify disabled order creation when no address exists, selected radio has keyboard focus, and the Manage/Add link works.
5. Verify double-clicking Create order or Continue to payment does not send duplicate requests.
6. Verify order-created state stays pending until payment provider/webhook confirms results.
7. Repeat navigation between cart, checkout, and profile at mobile, tablet, desktop widths.

## Local commands

```bash
node --test scripts/tests/ui-cart-checkout.test.mjs
pnpm --filter @tradenest/web typecheck
pnpm --filter @tradenest/web exec eslint app/cart/page.tsx app/checkout/page.tsx
```
