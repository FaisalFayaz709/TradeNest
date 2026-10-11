# TradeNest Catalog

This capability implements the catalog slice supported by the Technical Blueprint while preserving the modular-monolith boundary.

## Blueprint-backed API surface

Public:

- `GET /api/v1/categories`
- `GET /api/v1/products`
- `GET /api/v1/products/:slug`

Admin category commands:

- `POST /api/v1/categories`
- `PATCH /api/v1/categories/:id`

Seller product commands:

- `POST /api/v1/products`
- `PATCH /api/v1/products/:id`
- `DELETE /api/v1/products/:id` (owning seller or Admin)
- `POST /api/v1/products/:id/images`
- `POST /api/v1/products/:id/publish`
- `POST /api/v1/products/:id/archive`
- `GET /api/v1/seller/products`

`PATCH /products/:id/inventory` is implemented for the owning seller; `reservedQuantity` remains backend-owned.

## Locked product lifecycle

Only command endpoints transition lifecycle state:

```text
DRAFT --publish--> ACTIVE --archive--> ARCHIVED

ACTIVE --admin moderation--> SUSPENDED  (state exists; no moderation endpoint is invented here)
```

Any invalid implemented transition returns `409 INVALID_STATE_TRANSITION`. `PATCH /products/:id` cannot accept `status`.

## Active seller boundary

Product creation calls `SellerModuleApi.requireActiveSeller(userId)`. Catalog does not query `seller_profiles` directly. This preserves the explicit module boundary while implementing the blueprint rule that only an ACTIVE seller can create products.

## Product + Inventory transaction

Creation performs Product and Inventory writes inside one Prisma transaction. New products start in `DRAFT`; inventory starts with the validated `stock` quantity and `reserved_quantity = 0`.

## Public visibility

Public catalog reads return only `ACTIVE` products. This is the implementation of the blueprint's DRAFT/publish model: unpublished, archived, and suspended products are not marketplace-visible. Seller-owned listing may include all statuses.

## Money representation

The blueprint-provided create contract accepts `price` as a Zod number. Catalog performs no floating-point arithmetic with it. The value is passed to Prisma/PostgreSQL `NUMERIC(12,2)` as a decimal string, and API product responses expose price as a decimal string.

`CATALOG_DEFAULT_CURRENCY` is a required three-letter environment setting because the blueprint database requires product currency but the locked `CreateProductSchema` does not include a currency field. The API therefore does not modify the blueprint-provided create contract.

## Category tree integrity

Admin category mutation validates that a parent exists and prevents self/cyclic parent relationships. Category slug values are generated server-side and remain stable after renaming.

## Images

The blueprint permits S3-compatible storage or Cloudinary but does not lock an upload flow. This capability therefore implements only product-image metadata registration (`objectKey`, `url`, ordering, primary flag). It does not select a storage provider or upload protocol.

## Delete behavior

`DELETE /products/:id` is a true delete when PostgreSQL permits it. If cart/order/review/wishlist or other protected relations block deletion, the API returns `409 PRODUCT_DELETE_BLOCKED`; it does not silently archive or destroy history.

## inventory extension

`PATCH /products/:id/inventory` is now implemented for the owning seller. The seller controls only `availableQuantity`; `reservedQuantity` remains backend-owned. Atomic reserve/release/consume commands live behind `CatalogModuleApi`. See `docs/inventory.md` for the concurrency and checkout-transaction boundary.
