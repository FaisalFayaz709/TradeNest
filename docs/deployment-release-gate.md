
> **Current release status:** The Stripe Checkout test-mode adapter, durable test-mode refunds, and payment-initiation recovery safeguards are implemented. Stripe live-money charges/refunds remain disabled. Sandbox is available. This is NOT real-money production approval.

# Deployment release gate

This capability prepares a **vendor-neutral reference deployment** without pretending that environment-specific production decisions have already been made.

## Source-complete deployment controls

The repository now enforces these deployment invariants in source:

- Next.js and the single NestJS marketplace deployable use Node.js 24 images.
- The repository package manager remains pinned to pnpm 10.15.1.
- Node images install dependencies with `--frozen-lockfile` and explicitly copy `pnpm-lock.yaml` into the dependency stage.
- PostgreSQL remains version 18.
- FastAPI remains an internal Python 3.13 service and installs an exact tested dependency set from `services/ai/requirements.lock`.
- Prisma migrations run once before API startup.
- Web readiness depends on NestJS readiness; NestJS readiness depends on PostgreSQL. AI remains advisory and does not redefine core marketplace readiness.
- PostgreSQL and FastAPI are not published to the host by the reference Compose topology.
- Application and migration containers run with `no-new-privileges` and all Linux capabilities dropped.
- Deployment secrets remain runtime environment values and are not baked into images.
- Deployment environment validation rejects placeholders, obvious test databases, weak secrets, non-HTTPS public API URLs, and unsupported payment-provider selections.

## Fail-closed operator acceptance

Run the acceptance path only from the locked toolchain:

```bash
cp infrastructure/docker/deploy.env.example infrastructure/docker/deploy.env
# replace every placeholder in deploy.env
pnpm deploy:preflight
pnpm deploy:config
pnpm deploy:build
pnpm deploy:up
pnpm deploy:smoke
```

`deploy:preflight` intentionally fails unless all of the following are true:

1. Node.js major version is exactly 24.
2. pnpm is exactly 10.15.1.
3. a reviewed shared-workspace `pnpm-lock.yaml` exists.
4. Docker and Docker Compose are available.
5. the deployment environment passes the secret/database/public-URL checks.

`deploy:smoke` verifies API liveness/readiness and web liveness/readiness after startup.

## Explicit production decisions still open

These are not silently chosen by this capability because the blueprint leaves them open:

- **Production payment gateway:** Both sandbox and Stripe **test mode** are implemented; the deployment validator accepts `PAYMENT_PROVIDER=stripe` only with `sk_test_`, a valid webhook secret, and an HTTPS return origin. Stripe `sk_live_` operations remain disabled in source. Signed webhooks do not authorize live-money launch or establish legally regulated escrow custody. Live gateway and settlement acceptance is still required.
- **Object storage provider:** Storage implements an S3-compatible signed-upload and private-evidence adapter. Choose and configure a legitimate accessible storage bucket and validate live uploads, credentials, network reachability, and private downloads. Cloudinary remains a blueprint-permitted alternative but is not the adapter implemented here.
- **Initiation recovery:** Payment compliance persists a durable payment UUID and incomplete idempotency claim before external Stripe I/O. Retry with the exact original Idempotency-Key, never with a fresh key. Uncertain operations beyond the safe Stripe idempotency window are quarantined for manual reconciliation; a production operator tool/procedure and provider failure-injection evidence are still required.
- **Cloud host, TLS/ingress, secrets manager, log/metrics backend, backup/restore platform, and multi-replica rate-limit authority.** These remain deployment decisions, not reasons to split the marketplace modular monolith.

## Required runtime verification

The repository does **not** ship a fabricated `pnpm-lock.yaml`. Create and review an authentic lockfile using Node.js 24 and pnpm 10.15.1. Execute the locked-runtime `deploy:acceptance` command on PostgreSQL 18 with Docker and the configured payment/storage test environments before production release. Source-only gate results are not production certification.
