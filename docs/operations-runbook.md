# Operations — Deployment, Operations & Release Acceptance

## Architecture and release readiness

TradeNest remains a **single NestJS modular monolith** (Node.js 24) with Next.js 16, PostgreSQL 18/Prisma 7, Zod 4, and an internal Python/FastAPI service. No migration, financial state machine, public API, or locked technology decision is replaced in this capability. This work adds **operator tooling and release checks**, not a hosting provider or a promise that financial services are licensed.

**The source implementations are delivered; this archive is NOT production approved.** Reproducible builds and integration tests still require a real Node.js 24 + pnpm 10.15.1 toolchain, a reviewed genuine `pnpm-lock.yaml`, Docker/PostgreSQL 18, a Stripe *test-mode* account, and a real S3-compatible test bucket. No synthetic lockfile or fake live-acceptance evidence is permitted. Stripe live-money charges remain intentionally disabled.

## Pre-release sequence (staging only)

1. Generate and review the authentic workspace lockfile in the locked toolchain; commit it. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
2. Use isolated staging credentials, databases, S3 bucket and Stripe test-mode keys. Keep `infrastructure/docker/deploy.env` out of version control. Verify the database is PostgreSQL 18 and the Stripe key starts with `sk_test_`.
3. Run `pnpm acceptance:security`. This is the inherited complete test suite; do not label skipped Jest, migration, S3, payment, or Playwright tests as passed.
4. Run `pnpm deploy:preflight`, `pnpm deploy:config`, `pnpm deploy:build`, `pnpm deploy:up` and `pnpm deploy:smoke` on staging. Confirm the reverse proxy terminates TLS and PostgreSQL/FastAPI are not public.
5. Run the one-shot external health probe. Configure an actual scheduler/monitor to run it and alert on nonzero exit codes. Retain redacted operational results, not secret values.
6. Run the PostgreSQL backup and recovery drill below. Verify production-equivalent restore performance, key application tables and a representative read-only buyer/seller/admin query. Do not confuse successful SQL restore with complete business recovery.
7. Review payment-idempotency and reconciliation handling, pending Checkout-session cleanup, refunds, blocked disputed escrow releases, notification delivery, storage privacy, audit logs and monitoring. Record remaining exceptions and owners.
8. Obtain human approval for the deployment topology, reverse-proxy/TLS rules, storage/backup encryption, legal fund custody/settlement, disaster recovery objectives and rollback procedure **before** a real-money production launch.

## Backup: protected custom-format PostgreSQL archive

Run from a locked, approved operator host with Docker Compose access to the staging or production database. Backups may contain passwords hashes, addresses, transaction metadata and other sensitive data. Never upload an unencrypted backup to a repository or chat.

```bash
# Choose a UNIQUE filename; this tool refuses overwrites.
node scripts/ops-backup.mjs --output .tradenest-backups/tradenest-2026-10-09.dump
```

- Uses `docker compose exec -T postgres pg_dump -Fc --no-owner --no-acl` with argument arrays (no shell expansion).
- Verifies running PostgreSQL major version 18, the `PGDMP` archive header, byte count and SHA-256.
- Writes a restricted `.dump` and `.dump.manifest.json` (mode `0600`) only after successful dump; incomplete artifacts are cleaned up.
- Backups are sensitive **even when checksummed**: implement encryption in transit/at rest, off-host replication, access restrictions, tested retention, and regular key rotation in your chosen infrastructure. This tooling itself does **not** encrypt or send backups off-host.
- A backup alone is **not** evidence of recovery readiness; perform the restore drill.

## Restore drill: NEVER to the live database

```bash
node scripts/ops-restore-drill.mjs \
  --backup .tradenest-backups/tradenest-2026-10-09.dump \
  --target tradenest_drill_recovery \
  --confirm 'RESTORE tradenest_drill_recovery'
```

- Requires the original checksum manifest and validates the PostgreSQL custom-format archive.
- **Fails closed** unless the target is a *new* database named `*_recovery`, distinct from `POSTGRES_DB`. Existing recovery databases are never overwritten.
- Creates the new database, runs `pg_restore --single-transaction --exit-on-error` and checks that public tables are present.
- Inspect restored row counts and representative invariants, then retire the recovery database using a separately approved manual operation. **It never drops any database automatically.** Failed drills leave the isolated database in place for diagnosis.
- Measure restore duration, RTO, RPO and coverage against your organization's targets. This blueprint does not specify numerical RTO/RPO values; choose and document them with your operations owner.

For unattended production backups, configure an operator-controlled scheduler and encryption provider. Do **not** insert plaintext backup secrets into repository CI or command-line output.

## Monitoring and observability

```bash
node scripts/ops-health-check.mjs \
  --web https://shop.example.org \
  --api https://api.example.org
```

The probe checks liveness and readiness of both deployed services with timeouts and no redirect following. External origins must be HTTPS; loopback HTTP is accepted for local tests only. JSON output is intentionally low sensitivity and exits nonzero for any failed check. A real alert destination, log/metrics service, escalation owner, retention policy and audit access must be configured by the deployer. Existing NestJS `/api/v1/observability/metrics` remains protected by the configured bearer token; do not expose it publicly without separate access controls. AI/DB should remain on private networks.

## Automated release acceptance (staging ONLY)

After all earlier live gates and the proper deployment environment work, use a **separate deployment environment with `POSTGRES_DB=tradenest_staging` (and a matching staging `DATABASE_URL`)**, staging-only service accounts and test providers. Automated acceptance deliberately refuses a database name without `_staging`. Set unique backup/drill details and run:

```bash
export RELEASE_STAGING_ACK=STAGING_DRILL_AUTHORIZED
export RELEASE_BACKUP_OUTPUT=.tradenest-backups/operations-staging-unique.dump
export RELEASE_RECOVERY_DATABASE=tradenest_release_recovery
export RELEASE_WEB_ORIGIN=https://shop.example.org
export RELEASE_API_ORIGIN=https://api.example.org
pnpm acceptance:operations
```

It runs Operations source checks and tests, **all prerequisite security and integration acceptance**, deployment preflight/Compose/build/start/smoke, external health monitoring, backup and isolated restore. On any failure it stops and prints **NOT ACCEPTED**; it will not claim that missing infrastructure tests passed.

**Caution:** The reference Docker Compose deployment is a vendor-neutral starting point, not a turnkey production cloud topology. It binds web/API to loopback by default. Configure TLS ingress, secrets rotation, periodic encrypted offsite backups, tested rollback/migration procedures, monitoring alerts, capacity planning, and legal/compliance review separately. Run at one API replica for the existing in-memory limiter unless a shared limiter authority is designed and tested.

## Final human release sign-off checklist

Do not declare production readiness until an accountable operator has reviewed and recorded:

- [ ] Immutable dependency lockfile, Node 24/pnpm 10.15.1 PostgreSQL 18 environment, frozen install and all builds.
- [ ] All prerequisite source + live integration/Jest/Playwright test report; Stripe signed test webhooks and S3 privacy.
- [ ] Payment/escrow refund/payout reconciliation and late-callback handling tested, no unresolved severe financial defects.
- [ ] TLS/ingress, cookie/security headers, runtime secrets, backup encryption, storage permissions, and trusted-proxy rate limits tested.
- [ ] PostgreSQL 18 backup restored into a *separate* database; critical data reconciled, restoration elapsed time recorded.
- [ ] Monitoring and alert delivery, log retention/redaction, incident escalation and rollback simulations confirmed.
- [ ] Agreed RPO/RTO, off-site retention and credential-rotation owner recorded.
- [ ] Gateway settlement/custody arrangements legally and operationally approved; **logical escrow alone is not licensed escrow**.
- [ ] Sign-off record dated with build commit SHA, artifacts, operator, and approved change window.

This repository does not self-certify these human and environment-specific decisions.
