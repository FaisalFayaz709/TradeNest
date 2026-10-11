# Business module boundaries

These directories implement the business-module layout locked by the TradeNest blueprint's modular-monolith architecture.

Rules:

1. The marketplace remains one NestJS deployable application and one PostgreSQL database.
2. A module owns its business rules and exposes an explicit service/API boundary to other modules.
3. Controllers must not call Prisma directly.
4. A module must not import another module's internal files. Cross-module imports are permitted only from that module's `public/` directory.
5. Sharing one database does not permit one module to mutate another module's records directly.
6. The FastAPI service is reached through `AIBridgeModule`; it is not a public browser backend.

Each `public/module-api.ts` file defines only the cross-module methods justified by implemented domain behavior. Callers depend on these explicit seams rather than repositories or Prisma.
