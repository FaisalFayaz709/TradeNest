# TradeNest module boundaries

## Source-locked architecture

The TradeNest blueprint defines the core backend as one NestJS modular monolith with one PostgreSQL database. Its architecture diagram names these business areas: Auth, Users, Catalog, Cart, Orders, Payments, Escrow, Shipping, Disputes, Seller, Analytics, AI Bridge, Admin, and Notifications. It also states that a module owns its business rules, controllers do not call Prisma directly, and modules must not directly mutate another module's records merely because they share a database.

These boundaries govern the implemented business modules and their cross-module interactions.

## Filesystem contract

Each business module lives under:

```text
apps/api/src/modules/<module>/
  <module>.module.ts
  README.md
  public/
    index.ts
    module-api.ts
```

`public/` is the only legal import surface for another business module. Internal folders such as `application/`, `domain/`, and `infrastructure/` remain private to the owning module.

## Public contract policy

Every module has a named TypeScript `*ModuleApi` interface and injection token. Public methods exist only where implemented domain behavior justifies a cross-module seam; callers must depend on those seams rather than repositories or Prisma.

## Platform modules

`HealthModule` and `DatabaseModule` are platform/infrastructure modules rather than business-domain modules. Database access belongs in repository/infrastructure code; controllers may never access Prisma directly.

## Cross-module mutation rule

A shared PostgreSQL database is a deployment choice, not permission to bypass ownership. A module that needs an action owned by another module must call that module's explicit public service/API. Direct cross-module repository access, internal imports, or ad-hoc cross-table mutation are architecture violations.

## AI boundary

FastAPI remains a separate specialized ML workload. Browser-facing APIs remain owned by NestJS. Marketplace modules do not call FastAPI directly; AI calls go through `AIBridgeModule`.
