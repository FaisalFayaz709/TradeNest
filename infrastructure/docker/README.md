# TradeNest container deployment shape

`docker-compose.yml` remains the local-development PostgreSQL helper. The production-oriented reference shape is `docker-compose.deploy.yml` plus the Dockerfiles in this directory.

Locked deployment components:

- `web`: Next.js 16 on Node.js 24 LTS.
- `api`: one NestJS modular-monolith deployable on Node.js 24 LTS.
- `postgres`: PostgreSQL 18 durable marketplace state.
- `ai`: internal Python 3.13/FastAPI ML workload.
- `migrate`: one-shot Prisma migration job using the API image.

Before any build, create `deploy.env` from the example and run `pnpm deploy:preflight`. Preflight fails unless Node.js 24, pnpm 10.15.1, a reviewed `pnpm-lock.yaml`, Docker/Compose, and valid deployment secrets/config are present.

Node Dockerfiles use `pnpm install --frozen-lockfile`. The AI Dockerfile uses `services/ai/requirements.lock`. Web health uses `/api/health/ready`, which verifies the internal NestJS readiness endpoint rather than reporting only Next.js process liveness.

The reference profile publishes only web/API, binds them to loopback by default, leaves PostgreSQL/FastAPI internal, uses a one-shot migration job, enables `no-new-privileges`, and drops Linux capabilities for application/migration containers.

Cloud host, TLS/ingress, production payment gateway, object-storage choice (S3-compatible or Cloudinary), secrets manager, telemetry backend, backups, and multi-replica limiter authority remain explicit deployment decisions. See `docs/deployment-release-gate.md`.
