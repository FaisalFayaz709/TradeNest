# ADR-034 — Vendor-Neutral Observability Hardening

## Status

Accepted for this decision.

## Context

The Technical Blueprint explicitly includes observability in the implementation workstream Hardening but does not lock an observability vendor, tracing backend, metric store, or log collector. TradeNest already had request IDs from this decision but did not yet provide systematic request/dependency metrics or privacy-bounded operational logs.

## Decision

1. Keep observability vendor-neutral.
2. Reuse the existing `x-request-id` as the correlation identifier and propagate it from NestJS to FastAPI.
3. Use `AsyncLocalStorage` only for request correlation; do not place user/business state in that context.
4. Emit structured JSON operational logs with bounded, explicitly selected fields only.
5. Aggregate process-local Prometheus-compatible counters and histograms without Prisma persistence.
6. Label NestJS HTTP metrics by controller/handler instead of raw URL, and FastAPI metrics by route template, avoiding resource IDs and high-cardinality labels.
7. Protect the NestJS metrics endpoint with a deployment secret (`OBSERVABILITY_METRICS_TOKEN`) and constant-time comparison. If no token is configured, the endpoint is disabled.
8. Keep FastAPI metrics internal to the already-locked private AI service boundary.
9. Measure NestJS→FastAPI dependency outcomes and latency without logging request payloads.
10. Add no external telemetry SDK/vendor dependency in this document.

## Consequences

- A deployment can collect JSON logs and Prometheus-format metrics with common infrastructure without coupling TradeNest to one vendor.
- Request IDs correlate public API work with internal AI work.
- Per-process metrics reset on restart and are not globally aggregated across replicas; aggregation belongs to deployment infrastructure.
- This document does not implement distributed tracing spans, an observability SaaS integration, or centralized storage.
- No marketplace business rule, financial state machine, public commerce contract, Prisma model, or migration changes.
