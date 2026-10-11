# ADR-003 — Modular-monolith code boundaries

- **Status:** Accepted for this decision
- **Scope:** Code organization only
- **Source:** TradeNest Technical Blueprint, section 3

## Context

The blueprint locks the marketplace backend to a NestJS modular monolith and requires explicit module boundaries. It also forbids controller-to-Prisma access and warns against direct cross-module record mutation merely because modules share one PostgreSQL database.

## Decision

1. Business modules live under `apps/api/src/modules/<module>`.
2. The blueprint-named modules are created now: Auth, Users, Catalog, Cart, Orders, Payments, Escrow, Shipping, Disputes, Seller, Analytics, AI Bridge, Admin, and Notifications.
3. Each module exposes a `public/` directory as its only legal cross-module import surface.
4. Each module receives a named `*ModuleApi` TypeScript interface and injection token; methods are added only when an implemented cross-module behavior requires them.
5. Concrete public methods must be justified by blueprint-supported implemented behavior.
6. Automated verification rejects cross-module imports that bypass `public/` and rejects direct Prisma imports from controllers.
7. No feature controller, repository, domain service, database model, or business rule is added in this document.

## Why the public interfaces are empty

The blueprint requires explicit service/API communication but does not define exact internal signatures. Module APIs therefore stay minimal and expose only methods required by implemented behavior.

## Consequences

- Module ownership is visible before feature code exists.
- Later code has a mechanically enforceable cross-module import rule.
- Public service contracts evolve only when required by a feature implementation.
- The application remains one deployable NestJS backend; these are code boundaries, not microservices.
