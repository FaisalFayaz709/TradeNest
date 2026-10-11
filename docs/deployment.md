# Deployment preparation

This capability completes the architecture deployment-preparation slice while preserving the locked architecture and keeping provider-specific infrastructure decisions explicit.

## Containers

- `web`: Next.js 16 on Node.js 24 LTS.
- `api`: the single NestJS modular monolith on Node.js 24 LTS.
- `postgres`: PostgreSQL 18.
- `ai`: Python 3.13 + FastAPI, internal to the backend network.
- `migrate`: one-shot Prisma `migrate deploy` execution from the API image.

The Node images require the reviewed workspace `pnpm-lock.yaml` and use `pnpm install --frozen-lockfile`. The AI image installs the exact tested runtime dependency set in `services/ai/requirements.lock` before installing the local package with dependency resolution disabled.

## Startup and readiness contract

PostgreSQL must become healthy before migration. Migration must complete successfully before the API starts. API readiness requires PostgreSQL. Web readiness calls the internal API readiness endpoint, so a healthy web container proves its critical marketplace backend is ready as well.

FastAPI is intentionally not a critical startup dependency of the marketplace API because AI is advisory; an AI outage must not redefine checkout/payment/order readiness.

## Network and process security

The reference Compose file publishes only web and API, bound to loopback by default. PostgreSQL and FastAPI remain internal. TLS/reverse proxy configuration is external to this vendor-neutral profile.

Application and migration containers run as non-root where their base images permit it, enable `no-new-privileges`, and drop all Linux capabilities. Secrets are injected at runtime rather than copied into images.

## Deployment environment

Copy `infrastructure/docker/deploy.env.example` to `infrastructure/docker/deploy.env`, replace every placeholder, and never commit the populated file.

`NEXT_PUBLIC_API_BASE_URL` is a browser-visible build input and must use the externally reachable HTTPS `/api/v1` path. `TRADENEST_API_INTERNAL_URL` remains the server-only web-to-API Docker-network path.

The deployment profile supports `PAYMENT_PROVIDER=sandbox` (default) or `PAYMENT_PROVIDER=stripe` with **test-mode keys only**. In Stripe test mode set `PAYMENT_STRIPE_SECRET_KEY`, `PAYMENT_STRIPE_WEBHOOK_SECRET`, and `PAYMENT_STRIPE_RETURN_ORIGIN` (a bare HTTPS origin). Compose forwards these values to the NestJS API; the validator explicitly rejects live-money keys. An S3-compatible bucket must also be configured and verified for uploads/evidence. See `docs/payment-compliance-controls.md` for release blockers.

## Migration rule

Run Prisma `migrate deploy` as the one-shot `migrate` service. Do not run development migrations in production and do not let every API replica race to apply migrations.

## Acceptance commands

```bash
pnpm deploy:preflight
pnpm deploy:config
pnpm deploy:build
pnpm deploy:up
pnpm deploy:smoke
```

`pnpm deploy:acceptance` runs the config/build/up/smoke sequence after preflight. See `docs/deployment-release-gate.md` for the fail-closed prerequisites and the production decisions that intentionally remain open.
