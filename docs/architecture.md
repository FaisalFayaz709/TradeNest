# Architecture Contract

Source: TradeNest Technical Blueprint §§2–3, 15–17.

## System shape

```text
Browser / Next.js
       |
       | REST + shared Zod contracts
       v
+------------------------------------------------+
| NestJS Modular Monolith                        |
|                                                |
| Auth       Users       Catalog                 |
| Cart       Orders      Payments                |
| Escrow     Shipping    Disputes                |
| Seller     Analytics   AI Bridge               |
| Admin      Notifications                       |
|                                                |
| Prisma Repository Layer                        |
+--------------------------+---------------------+
                           |
                           v
                      PostgreSQL
                           |
                           +----> FastAPI AI service
                           +----> Payment provider
                           +----> Object storage
```

The module names above reflect the blueprint's architecture diagram. Exact internal class/file names are implementation details.

## Non-negotiable module-boundary rules

1. The marketplace backend is **one NestJS deployable application**.
2. The marketplace uses **one PostgreSQL database**.
3. A module owns its business rules and exposes explicit services/APIs to other modules.
4. Controllers do **not** call Prisma directly.
5. A module does **not** directly mutate another module's records merely because the database is shared.
6. FastAPI is separate because ML is a specialized Python workload, not because the marketplace is being decomposed into microservices.

## Required application layering

A safe default internal flow is:

```text
HTTP Controller
      ↓
Application / Domain Service
      ↓
Repository boundary
      ↓
Prisma
      ↓
PostgreSQL
```

The exact repository abstraction shape is not fully prescribed by the blueprint, but direct Controller → Prisma access is explicitly forbidden.

## Public/API boundary

The browser communicates with the NestJS public API. The browser must not call FastAPI directly.

NestJS may call FastAPI internally for recommendation/pricing/fraud workloads.

## Frontend authority boundary

Next.js may:

- collect input;
- provide fast UX validation;
- request domain actions;
- display returned state.

Next.js must not authoritatively decide:

- product/current checkout price;
- inventory availability;
- order status;
- payment success;
- escrow state;
- legal state transitions.

## Persistence boundary

Prisma is the application persistence layer. PostgreSQL constraints are the final durable integrity boundary.

Prisma models are **not** public API contracts.

## Deployment compatibility

The modular monolith may later be containerized and deployed behind scalable cloud infrastructure. Load balancing, separate database hosting, and other deployment evolution are compatible with the blueprint so long as the core marketplace is not prematurely split into microservices.
