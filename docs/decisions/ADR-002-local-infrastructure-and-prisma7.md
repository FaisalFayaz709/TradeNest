# ADR-002 — Local infrastructure and Prisma 7 wiring

- **Status:** Accepted for this decision
- **Scope:** Implementation details left open by the Technical Blueprint

## Context

The blueprint locks PostgreSQL 18, Prisma ORM 7, Docker Compose for development, one PostgreSQL database, and a NestJS-owned backend. It does not prescribe local host bindings, connection-pool defaults, environment-file mechanics, or the exact Prisma 7 adapter configuration.

## Decision

1. Docker Compose runs PostgreSQL 18 as the only container required by this decision.
2. Local PostgreSQL is published on `127.0.0.1` only.
3. The API loads `.env` using `dotenv` and validates server environment values with Zod through `@tradenest/config`.
4. Prisma ORM remains on major 7 and uses its PostgreSQL `pg` driver adapter at runtime.
5. `prisma7.config.ts` owns the Prisma CLI datasource URL; `schema.prisma` contains only the PostgreSQL provider and client generator in this document.
6. No marketplace/domain models or migrations are created in this decision.
7. API liveness is independent of PostgreSQL; API readiness checks PostgreSQL using a service layer rather than controller-to-Prisma access.

## Consequences

- A running API process can report liveness even when PostgreSQL is unavailable.
- Readiness gives a meaningful database dependency check.
- Database model work remains isolated in its dedicated database-foundation decision.
- The implementation remains compatible with the blueprint's controller and persistence boundaries.

## Blueprint compatibility

This ADR does not change the locked architecture or stack. If it conflicts with the Technical Blueprint, the blueprint prevails.
