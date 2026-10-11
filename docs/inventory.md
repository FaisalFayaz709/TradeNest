# Inventory

## Blueprint scope

This capability implements the locked seller inventory endpoint and prepares the concurrency-safe inventory operations required by checkout.

Locked blueprint requirements implemented here:

- `PATCH /api/v1/products/:id/inventory` is available only to the owning seller.
- inventory stores `available_quantity` and `reserved_quantity`, both non-negative;
- checkout reserves inventory safely under concurrency so two buyers cannot purchase the same final stock;
- business ownership remains backend enforced; role alone is insufficient.

## Seller-facing update contract

The blueprint defines the endpoint but not its request body. This capability therefore makes the narrow implementation decision that a seller may set only:

```json
{
  "availableQuantity": 25
}
```

`reservedQuantity` is deliberately not client-authoritative. It represents stock already reserved by backend commerce workflows and can only be changed by inventory reservation commands.

The allowed range is `0..1,000,000`, matching the locked `CreateProductSchema.stock` range.

## Atomic inventory model

A reservation is represented by:

```text
available_quantity -= quantity
reserved_quantity  += quantity
```

and succeeds only when:

```text
available_quantity >= quantity
```

The predicate and both updates are issued as one conditional PostgreSQL update through Prisma. This prevents two concurrent requests from both reserving the same final units.

Release:

```text
reserved_quantity  -= quantity
available_quantity += quantity
```

and succeeds only when the requested quantity is currently reserved.

Consume:

```text
reserved_quantity -= quantity
```

and succeeds only when the requested quantity is currently reserved. Available stock was already decremented at reservation time.

## Module boundary

Only `CatalogRepository` accesses the Inventory persistence model.

```text
HTTP / other module
       ↓
CatalogService / CatalogModuleApi
       ↓
CatalogRepository
       ↓
Prisma
       ↓
PostgreSQL 18
```

Other modules must use `CatalogModuleApi`; they must not import `CatalogRepository`, `PrismaService`, or mutate the `inventory` table directly.

## Important transaction boundary note

Each inventory mutation is atomic, and checkout composes reservation with the broader order/payment transaction as documented in `docs/transactional-checkout.md`.

Checkout combines inventory reservation, order creation, immutable order-item snapshots, and payment-intent creation through shared transaction orchestration before inventory commands participate in the complete checkout workflow.

Do not implement checkout by independently reserving stock and then creating an order in a separate transaction.
