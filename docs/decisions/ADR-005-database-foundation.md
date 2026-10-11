# ADR-005 — Database foundation materialization

- **Status:** Accepted for this decision
- **Classification:** ALLOWED IMPLEMENTATION DECISION around LOCKED blueprint persistence requirements
- **Authority:** TradeNest Technical Blueprint §§6, 7, 8, 9, 11, 12

## Context

The blueprint locks PostgreSQL 18, Prisma ORM 7, one database, the table inventory, key table fields, several state machines, hard constraints, indexes, immutable order snapshots, and PostgreSQL as the final integrity boundary. It does not fully define every column, every enum vocabulary, every relation delete action, timestamp precision, or the exact mechanism for enforcing one active cart per user.

This decision must make the database executable without turning unspecified implementation choices into fake locked requirements.

## Decision

1. Materialize all 26 blueprint-named tables in `schema.prisma` and the initial PostgreSQL migration.
2. Map Prisma models/fields to snake_case PostgreSQL table and column names matching blueprint terminology.
3. Use Prisma `Decimal` / PostgreSQL `DECIMAL(12,2)` for authoritative commerce money.
4. Put blueprint-defined state machines in PostgreSQL/Prisma enums where their value set is explicit.
5. Keep incompletely specified vocabularies as strings until their feature implementation defines them.
6. Use only a minimal `PaymentStatus` (`PENDING`, `SUCCEEDED`, `FAILED`) and `DisputeStatus` (`OPEN`, `RESOLVED`) foundation. These are implementation-level sets, not a claim that the blueprint forbids future states.
7. Enforce blueprint CHECK constraints in the SQL migration because Prisma ORM 7 does not express PostgreSQL CHECK constraints in its schema language.
8. Represent the blueprint's “one active cart per user” rule with `carts.is_active` and a PostgreSQL partial unique index on active carts.
9. Keep financial/history FKs restrictive; cascade only clearly owned/ephemeral records; use `SET NULL` for optional analytical history references.
10. Add minimal fields to tables whose exact columns were omitted by the blueprint. Those additions are explicitly documented in `docs/database-schema.md` and remain changeable implementation details.
11. Do not expose `PrismaService` to business modules in this decision. Database structure does not grant cross-module mutation rights.

## Why CHECK constraints are in migration SQL

Prisma ORM 7 can use a database that contains CHECK constraints, but its Prisma schema does not yet model those constraints. PostgreSQL therefore owns the checks directly, consistent with the blueprint's integrity rule.

## Alternatives considered

### Encode all checks only in NestJS/Zod

Rejected. It would violate the blueprint's requirement that PostgreSQL be the final integrity boundary and would be unsafe under concurrency/direct DB access.

### Invent complete enum sets for every status field

Rejected. The blueprint does not define all seller, shipping, payment, dispute, fraud and notification vocabularies. Guessing them would silently convert implementation assumptions into apparent specification.

### `UNIQUE(user_id, is_active)` for carts

Rejected. That would permit only one inactive cart as well as one active cart. The blueprint requires only the active-cart uniqueness rule. A PostgreSQL partial index expresses that invariant precisely.

## Consequences

### Positive

- The database now represents the complete blueprint table inventory.
- Locked integrity rules are enforced at PostgreSQL level.
- Financial and order history cannot be casually deleted.
- Future implementation work can evolve unspecified fields/states without rewriting locked architecture.
- Business modules still cannot bypass their module boundaries to access Prisma.

### Tradeoffs

- The initial migration contains SQL that Prisma schema cannot fully round-trip because of CHECK constraints and the partial unique index.
- Future migrations must preserve those database-native objects deliberately.
- Some practical columns are implementation choices rather than source-defined requirements.

## Compliance check

- [x] PostgreSQL 18 remains the database.
- [x] Prisma ORM 7 remains the application persistence layer.
- [x] One PostgreSQL database remains authoritative.
- [x] PostgreSQL enforces hard integrity constraints.
- [x] Order/payment/escrow remain separate state concepts.
- [x] Historical order-item snapshots are preserved.
- [x] Money uses decimal/numeric representation.
- [x] Controllers/business modules do not gain direct Prisma access.
- [x] No microservice split is introduced.
- [x] No AI behavior is introduced.

## Supersession rule

Future schema changes require migrations. An ADR may refine implementation-only columns or vocabularies, but no ADR can remove or weaken a LOCKED blueprint constraint without changing the blueprint itself.
