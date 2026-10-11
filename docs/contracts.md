# Shared contracts boundary

## Source-of-truth scope

The TradeNest Technical Blueprint locks **Zod 4** as the validation/contracts technology and places shared schemas under `packages/contracts/`. It also states that the same core schema may support frontend forms and backend request validation while backend validation remains mandatory because clients can bypass the UI.

The blueprint explicitly separates validation responsibilities:

| Layer | Responsibility |
| --- | --- |
| Frontend | Fast UX feedback |
| Backend Zod | Reject malformed/untrusted boundary input |
| Backend services | Business validation and domain policy |
| PostgreSQL | Hard integrity guarantees |

Therefore, shared schemas MUST NOT become a second domain-service layer.

## contract namespaces

```text
packages/contracts/src/
  auth/
  products/
  checkout/
  orders/
  payments/
  disputes/
  seller/
  common/
```

The filenames explicitly shown by the blueprint are also reserved:

```text
auth/register.ts
auth/login.ts
products/create-product.ts
products/update-product.ts
products/product-query.ts
```

## Concrete contracts allowed now

### CreateProduct

The blueprint provides the complete example schema, so this capability implements it directly:

- name: trimmed string, 3–200 chars
- description: trimmed string, 20–5000 chars
- categoryId: UUID string
- price: positive number, max 99,999,999
- stock: integer, 0–1,000,000
- sku: trimmed string, 1–100 chars

This is **syntax/boundary validation only**. It does not decide whether the category exists, whether the seller is ACTIVE, whether the seller owns a resource, or whether stock is actually available.

### Standard API envelopes

The blueprint defines:

- success: `{ data: ... }`
- collection: `{ data: [], meta: { page, limit, total, totalPages } }`
- error: `{ error: { code, message, details, requestId } }`

This capability provides reusable Zod schemas/factories for these shapes.

## Contract evolution policy

Where the blueprint does not provide a complete field-level schema, the repository does not invent fields without an implementation need and documented rationale. A concrete schema may be added or evolved only when one of these is true:

1. the blueprint specifies the fields/rules; or
2. an implementation decision is necessary and is documented as an ADR without contradicting the blueprint.

## Import guidance

Prefer narrow imports when a consumer only needs one domain:

```ts
import { CreateProductSchema } from '@tradenest/contracts/products';
```

The root export remains available for convenience:

```ts
import { CreateProductSchema } from '@tradenest/contracts';
```

## Non-negotiable separation

Examples from the blueprint:

- Zod can validate a positive integer quantity; services/database decide whether inventory exists.
- Zod can validate a UUID; services decide whether the category exists.
- RBAC can validate SELLER; policy logic verifies ownership.
- A syntactically valid status enum does not make a state transition legal.

Any shared schema that attempts to replace those service/database checks violates the architecture contract.
