# ADR-041 — Fail-Closed Deployment Acceptance

## Status
Accepted for this decision.

## Context

The architecture plan defines this decision as deployment preparation. Earlier work supplied a vendor-neutral Compose topology, but two release risks remained: frozen Node installs did not copy a lockfile into the Docker dependency stage, and deployment could be described as ready without proving the locked Node/pnpm/Docker toolchain was actually present.

The blueprint also deliberately leaves the production payment gateway, object-storage provider, cloud host, ingress/TLS vendor, and observability backend open. Deployment preparation must not silently choose or fake those decisions.

## Decision

1. Keep one Next.js deployable, one NestJS modular-monolith deployable, PostgreSQL 18, and one internal FastAPI AI service.
2. Require Node.js 24 and pnpm 10.15.1 at deployment acceptance time.
3. Require a reviewed `pnpm-lock.yaml`; production Node Docker builds use `--frozen-lockfile` and copy that lockfile before install.
4. Pin the tested Python 3.13 AI dependency closure in `services/ai/requirements.lock` and install the local project without a second dependency resolution cycle.
5. Make web container readiness depend on the internal NestJS readiness endpoint. NestJS continues to treat PostgreSQL as its critical readiness dependency; FastAPI remains advisory.
6. Add a fail-closed deployment preflight and post-start smoke test.
7. Drop all Linux capabilities for application/migration containers in addition to `no-new-privileges`.
8. Reject deployment configuration that selects a payment-provider identifier for which no audited adapter exists.
9. Keep the production payment gateway, S3-compatible-vs-Cloudinary selection, cloud topology, TLS/ingress, secrets manager, backup platform, telemetry backend, and distributed rate-limit store as explicit later deployment decisions.

## Consequences

- A missing lockfile or wrong runtime can no longer be mistaken for a production-ready build.
- The reference deployment remains executable once the locked environment and lockfile are supplied.
- This document improves operational readiness without changing marketplace business rules, Prisma schema, migrations, or module ownership.
- Full runtime/container certification remains an external acceptance step because it requires the locked deployment environment.
