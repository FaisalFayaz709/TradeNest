# TradeNest Observability Hardening

This capability adds vendor-neutral operational observability without moving marketplace authority or introducing durable business state.

## Correlation

The API's existing normalized `x-request-id` is placed into an `AsyncLocalStorage` request context. Internal NestJS calls to the FastAPI intelligence service forward that same request ID. FastAPI validates/normalizes the incoming value and echoes it in the response.

The correlation context contains only the request ID. It does not carry user identity, authorization headers, request bodies, query values, emails, addresses, payment data, or product/order identifiers.

## Structured operational logs

NestJS records one structured JSON completion event for controller requests and one structured JSON completion event for outbound AI dependency calls. FastAPI records structured JSON completion events for its internal HTTP requests.

HTTP log dimensions are intentionally bounded:

- request ID;
- method;
- NestJS controller/handler name or FastAPI route template;
- status code;
- duration;
- slow-request flag or dependency outcome.

Raw URLs, query strings, request/response bodies, cookies, authorization headers, IP addresses, email addresses, user IDs, order IDs, payment IDs, and AI payloads are not operational log dimensions.

## Metrics

NestJS keeps process-local operational counters/histograms for:

- in-flight HTTP requests;
- completed requests by method/controller-handler/status;
- request duration;
- outbound AI dependency calls by fixed operation/outcome;
- dependency duration;
- process uptime and memory gauges.

The API exposes Prometheus-compatible text at:

`GET /api/v1/observability/metrics`

The endpoint is enabled only when `OBSERVABILITY_METRICS_TOKEN` is configured and requires `Authorization: Bearer <token>`. Token comparison uses `timingSafeEqual`. The token is never placed in metrics or logs.

FastAPI exposes internal Prometheus-compatible request metrics at `/internal/metrics`. The AI service remains an internal workload and this endpoint must remain reachable only on the internal service network, consistent with the locked architecture.

Metrics use controller/handler names and route templates instead of raw request paths, preventing IDs/slugs from becoming labels and preventing unbounded per-resource cardinality.

## Slow requests

`OBSERVABILITY_SLOW_REQUEST_MS` controls the API slow-request warning threshold and defaults to 1000 ms. Slow requests are logged at warning level but are not rejected or otherwise given business meaning.

## Persistence and authority

Observability state is operational, process-local state. This capability adds no Prisma model and no migration. Metrics and logs cannot mutate Order, Payment, Escrow, Inventory, Catalog, User, Seller, Fraud, or AI recommendation business state.

The implementation intentionally does not select an external observability vendor; that remains a deployment decision.
