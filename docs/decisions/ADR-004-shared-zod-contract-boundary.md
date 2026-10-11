# ADR-004: Shared Zod contract boundary

- **Status:** Accepted for this decision
- **Scope:** `packages/contracts`
- **Authority:** TradeNest Technical Blueprint §§5 and 10

## Context

The blueprint locks Zod 4 for validation/contracts and explicitly proposes a shared `packages/contracts/` layout. It also distinguishes syntactic boundary validation from service-level business validation and PostgreSQL integrity.

Some contract locations are named without full field definitions. Inventing complete schemas during the foundation work would silently turn unspecified implementation choices into apparent locked requirements.

## Decision

1. `@tradenest/contracts` remains a pure TypeScript/Zod package with no NestJS, Prisma, React, database, network, or AI dependencies.
2. The blueprint-defined namespace layout is materialized now.
3. Concrete field-level schemas are implemented in this decision only when the blueprint actually provides the shape.
4. `CreateProductSchema` is implemented from the blueprint example.
5. Standard success/collection/error response envelopes are represented as reusable contracts.
6. Blueprint-named but field-undefined contracts remain compilable empty modules until their feature implementation.
7. Shared contracts validate transport/application boundaries only. Business policy stays in NestJS services; hard integrity stays in PostgreSQL.
8. Subpath package exports are provided for domain-focused imports. This packaging detail is an implementation decision and does not alter architecture.

## Consequences

- Frontend and backend can converge on the same syntax contracts without trusting the frontend.
- The codebase avoids prematurely guessing API payloads.
- Future feature implementations can evolve individual contract namespaces without crossing module/domain boundaries.
- Business rules cannot be justified merely because they appear in a Zod schema.
