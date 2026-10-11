# Contributing to TradeNest

All changes must remain compatible with the frozen TradeNest Technical Blueprint and `SPEC_LOCK.yaml`. Architecture correctness is determined from current source and executable invariants, not from historical implementation records.

## Required boundaries

- Keep the marketplace core as one NestJS modular monolith backed by one PostgreSQL database.
- Keep controllers away from direct Prisma access. Each module owns its persistence and exposes explicit public services/interfaces to other modules.
- Keep Prisma/database types out of public shared contracts. Public application contracts use Zod schemas from `packages/contracts`.
- Treat browser input as non-authoritative. Prices, totals, payment success, financial state, inventory state, and state-machine transitions are resolved by backend logic.
- Keep Order, Payment, and Escrow as separate state machines. Use command-style transitions rather than arbitrary status patches.
- Require authorization beyond roles where ownership or domain policy matters.
- Keep financial mutations transactional, idempotent where retries are possible, and audit-sensitive where required.
- Keep FastAPI internal and advisory. It must not become the public marketplace API or directly mutate marketplace authority.
- Preserve database constraints as the final integrity boundary. Schema changes require a migration and must preserve locked blueprint constraints.

## Contracts and validation

Validate TypeScript application boundaries with Zod. When an API request/response contract changes, update the shared contract first, then update consumers and tests. Do not expose Prisma models as transport contracts.

## Verification before merging

Architecture-sensitive changes should include:

```bash
pnpm verify:architecture
pnpm typecheck
pnpm lint
```

For behavior changes, also run the appropriate unit/integration/E2E/AI suites; `pnpm test:hardening` is the aggregate test command. Deployment-sensitive changes should run `pnpm deploy:preflight` and the deployment validation commands described in `docs/deployment-release-gate.md`.

## Documentation

Update durable domain documentation and ADRs when behavior or architecture changes. Do not add chronological implementation reports, point-in-time audit reports, progress-marker files, generated checksum inventories, or verification gates whose success depends on such artifacts. Release-specific evidence belongs in CI/release artifacts rather than the maintained source tree.
