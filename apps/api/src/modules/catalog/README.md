# CatalogModule

Owns categories, products, product images, inventory, product lifecycle commands, and public/seller catalog reads.

## Boundary rules

- Controllers never access Prisma.
- CatalogService never accesses Prisma.
- Only CatalogRepository reaches Category/Product/ProductImage/Inventory persistence.
- Seller activity is checked through `SellerModuleApi.requireActiveSeller()`; Catalog must not query `seller_profiles` directly.
- Product lifecycle state is command-driven (`publish`, `archive`), never arbitrary status PATCH.
- Seller inventory edits may change only `availableQuantity`; `reservedQuantity` is backend-owned.
- Inventory reserve/release/consume operations are conditional atomic updates and are exposed only through `CatalogModuleApi` for cross-domain orchestration.
- Atomic inventory primitives do not replace the blueprint-required checkout-wide transaction.
- Storage upload mechanics remain intentionally unselected; image metadata registration accepts a storage URL/key produced by the future selected storage integration.
