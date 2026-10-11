# Wishlist

## Locked API

- `GET /api/v1/wishlist` - Buyer
- `POST /api/v1/wishlist/:productId` - Buyer
- `DELETE /api/v1/wishlist/:productId` - Buyer

These routes are the wishlist operations specified by the TradeNest technical blueprint.

## Ownership

Wishlist is a Buyer-owned convenience relation and is implemented inside `UsersModule`; the blueprint does not define a separate Wishlist marketplace module. Every persistence query is scoped to the authenticated `userId`. A Buyer cannot list or delete another Buyer's wishlist row by guessing identifiers.

## Catalog boundary

Adding an item calls `CatalogModuleApi.requireWishlistEligibleProduct(productId)` through Catalog's public seam. This capability permits adding only an `ACTIVE` public product. This is an implementation-level visibility rule so the wishlist endpoint cannot be used as a product-existence oracle for non-public draft/archived products.

Existing wishlist rows are not a stock, price, seller-status, or checkout guarantee. A later product state change does not make wishlist state authoritative.

## Non-authoritative response

Wishlist responses contain only:

- wishlist item ID;
- product ID;
- created timestamp.

They intentionally do not contain authoritative price, inventory, order totals, seller eligibility, or recommendation scores. The corresponding owning modules remain authoritative.

## Duplicate add

The database already has `UNIQUE(user_id, product_id)`. The service also treats a repeated/concurrent add as an idempotent read of the existing row: one relation exists and the winning row is returned.

## Deferred

Wishlist itself does not emit recommendation/behavior events, implement personalized ranking, or couple wishlist state to cart/checkout. Behavior ingestion and AI recommendations are separate capabilities.
