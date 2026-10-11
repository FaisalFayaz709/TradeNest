# ADR-035 — Vendor-Neutral Deployment Preparation

## Status

Accepted for this decision.

## Context

the Blueprint workstream ends with deployment hardening, while the exact cloud host and production topology are intentionally not locked. The codebase already has separate Next.js, NestJS, PostgreSQL, and internal FastAPI responsibilities plus health/readiness endpoints.

## Decision

1. Keep deployment vendor-neutral and preserve the modular monolith.
2. Build Next.js and NestJS on Node.js 24 LTS, FastAPI on Python 3.13, and PostgreSQL on major version 18.
3. Package the NestJS marketplace as one API image; do not split marketplace modules into services.
4. Keep FastAPI internal-only in the reference Compose topology.
5. Run Prisma `migrate deploy` as a one-shot deployment job before API replicas become healthy; do not run schema migration independently in every replica.
6. Require deployment secrets/config through environment injection; never bake them into images.
7. Bind reference host ports to loopback by default and leave TLS/ingress to deployment infrastructure.
8. Run application containers as non-root users with `no-new-privileges` and health checks.
9. Reuse existing API/FastAPI/web health endpoints for container health; no marketplace state is introduced for deployment orchestration.
10. Do not add a cloud, ingress, observability, object-storage, or payment vendor in this document.

## Consequences

- The repository has an executable single-host/reference Compose deployment without locking TradeNest to a hosting provider.
- Operators can place an external TLS/ingress layer in front of the loopback-bound web/API ports.
- Horizontal scaling remains compatible with the modular monolith, but process-local rate-limit and metrics state remains per replica and must be accounted for by later infrastructure choices.
- Image installs currently use the repository's package ranges because the source snapshot does not contain a pnpm lockfile. The package-manager version is pinned; adding a generated lockfile in a locked Node.js 24 environment is recommended before production release.
- No Prisma schema or migration change is introduced.
