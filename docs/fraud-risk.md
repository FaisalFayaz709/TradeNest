# Fraud-Risk MVP

This capability implements the blueprint's rules + risk-scoring fraud MVP and the Admin review endpoint `GET /api/v1/admin/fraud-alerts`.

## Review, not accusation

Fraud output is a risk signal for human review, not accusation. A HIGH assessment sets `reviewRecommended=true`; it does not suspend a user, block checkout, fail a payment, cancel an order, release/refund escrow, change inventory, or otherwise mutate critical marketplace state.

Payment provider verification and the existing Payment/Order/Escrow transaction remain authoritative. Fraud assessment is best-effort and runs only after a non-duplicate terminal payment webhook has committed. If the internal AI service is unavailable, TradeNest logs the missed assessment and still acknowledges the valid provider webhook. Fraud analysis therefore does not block payment correctness or availability.

## Signals

The MVP uses only blueprint-supported signals that TradeNest can already measure:

- repeated payment failures in the last 24 hours;
- unusually high first-order candidates relative to the same-currency marketplace 95th-percentile successful payment amount;
- abnormal payment-attempt frequency over one hour / 24 hours;
- recent authenticated-session identity churn, represented by distinct IP addresses and user agents recorded by TradeNest.

The first-order comparison is same-currency only. No FX conversion is invented.

## Transparent rules and thresholds

The blueprint deliberately leaves fraud thresholds as an implementation decision. This capability uses `fraud-rules-v1` with normalized score thresholds:

- LOW: score < 0.35
- MEDIUM: 0.35 <= score < 0.70
- HIGH: score >= 0.70

Only HIGH recommends review. Reasons and their contributions are returned and persisted so Admin reviewers can see why an assessment was produced.

The current rule contributions are deliberately simple and bounded:

- repeated failures: up to 0.36;
- unusually high first-order candidate: 0.30;
- abnormal transaction frequency: up to 0.25;
- session identity churn: up to 0.20.

The total is clamped to 1.0000. These are implementation thresholds, not blueprint-locked fraud truth, and can be revised later with evidence.

## Architecture

```text
verified provider webhook
        |
        v
PaymentsModule commits authoritative state
        |
        | after commit, best-effort
        v
AIBridgeModule
        |
        +--> AnalyticsModule read-only fraud signals
        |
        +--> internal FastAPI /internal/fraud/score
        |
        +--> AnalyticsModule records fraud_assessments snapshot

Admin
  |
  v
GET /api/v1/admin/fraud-alerts
  |
  v
AdminModule -> AnalyticsModule read model
```

FastAPI receives only the payment amount/currency/outcome and aggregated signals. It receives no database credentials and cannot mutate marketplace state. Analytics owns `fraud_assessments` persistence and uses a payment-ID advisory lock plus `(paymentId, modelVersion)` application check to avoid duplicate snapshots from repeated scoring attempts without adding a new migration.

## Admin endpoint

`GET /api/v1/admin/fraud-alerts` is ADMIN-only. It accepts:

- `limit` (default 50, max 100);
- optional `riskLevel=LOW|MEDIUM|HIGH`.

Alerts are sorted by risk score descending and then newest first. The response includes assessment/subject IDs, score, level, reasons, model version, review recommendation, and creation time.

## Deferred

This capability does not implement automatic account suspension, automatic payment/order blocking, device fingerprinting, a chargeback model, supervised fraud training, or improved recommendation models. Those would require additional product/security policy and/or data not locked by the blueprint.
