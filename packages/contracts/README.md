# @tradenest/contracts

Shared **Zod 4** schemas and inferred TypeScript types for data crossing TradeNest TypeScript application boundaries.

## Responsibility

The Technical Blueprint assigns validation to multiple layers:

- frontend validation provides fast UX feedback;
- Zod validates untrusted application-boundary input/output shapes;
- NestJS services enforce business rules such as ownership, seller state, inventory availability, and legal state transitions;
- PostgreSQL enforces hard integrity guarantees under concurrency.

A shared schema never replaces service or database validation, and Prisma types are not public transport contracts.

## Contract surface

Domain namespaces cover authentication, users, seller, catalog/products, cart, checkout, orders, payments, escrow, shipping, disputes, reviews, wishlist, analytics, and AI-facing response contracts. Shared common contracts provide UUID validation, standard success/collection envelopes, pagination metadata, and the standard error envelope.

Where the blueprint gives an exact schema, the contract follows it. Where the blueprint leaves fields open, schemas are introduced only when implemented behavior requires them and the choice remains compatible with the locked architecture.

## Import guidance

Prefer narrow domain imports when possible:

```ts
import { CreateProductSchema } from '@tradenest/contracts/products';
```

The root export remains available for convenience:

```ts
import { CreateProductSchema } from '@tradenest/contracts';
```

## Non-negotiable separation

Contracts validate transport/application boundaries only. Authoritative pricing, totals, inventory, financial state, ownership, and state-machine legality stay in backend services and PostgreSQL.
