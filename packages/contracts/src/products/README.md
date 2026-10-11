# Product contracts

`CreateProductSchema` is implemented exactly from the field-level example in §10.1 of the Technical Blueprint.

Catalog contracts added in this contract surface cover category mutation, product editing, product discovery, product lifecycle output, and image metadata registration. Those field sets are documented implementation decisions where the blueprint defines an endpoint but not every request field.

This contract surface adds `UpdateInventorySchema` and `InventorySchema`. The seller-facing inventory patch accepts only `availableQuantity`. `reservedQuantity` is intentionally backend-owned and cannot be supplied by a seller. The stock ceiling of 1,000,000 matches the blueprint's locked `CreateProductSchema.stock` boundary.
