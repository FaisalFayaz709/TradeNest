# Buyer Cart

## Blueprint scope

This capability implements the five buyer cart endpoints:

- `GET /api/v1/cart`
- `POST /api/v1/cart/items`
- `PATCH /api/v1/cart/items/:itemId`
- `DELETE /api/v1/cart/items/:itemId`
- `DELETE /api/v1/cart`

## Non-authoritative cart rule

The blueprint states that a cart is convenient state, not a price or inventory guarantee. Accordingly, cart items store/expose only product identity and quantity. They do not persist or return an authoritative unit price, subtotal, total, stock guarantee, seller-status guarantee, or reservation.

At checkout, the backend must reload current products, seller state, prices, and stock and calculate authoritative totals. This capability intentionally does not implement those checkout actions.

## Product eligibility on add

When a buyer adds a product, CartModule calls the explicit CatalogModule public seam `requireCartEligibleProduct(productId)`. It only confirms that the product currently exists and is `ACTIVE`. This is a convenience validation and does not promise that the product will still be purchasable at checkout.

## Ownership

All item mutations are scoped by both `itemId` and the authenticated buyer's active `cartId`. A cart item UUID belonging to another buyer therefore behaves as not found.

## Active-cart concurrency

`GET /cart` and `POST /cart/items` use get-or-create semantics. The PostgreSQL partial unique index `carts_one_active_per_user_key` remains the final race-safe guarantee that one user cannot have two active carts. A concurrent create conflict is recovered by loading the winning active cart.

## Quantity

Zod requires a positive integer. PostgreSQL independently enforces `cart_items.quantity > 0`.

## Explicitly not in this capability

- inventory reservation
- checkout quote
- order creation
- payment intent
- prices/totals in cart state
- cross-seller checkout restrictions
