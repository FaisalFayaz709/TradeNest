# ADR-029: Fraud-risk is advisory review logic

## Status
Accepted in this decision.

## Context
The blueprint requires a fraud-risk MVP based on rules + risk scoring, lists payment failures, unusually high first orders, abnormal transaction frequency and suspicious account/device patterns as candidate signals, and states that high risk should normally trigger review rather than automatic accusation. Exact fraud thresholds are explicitly not locked.

## Decision
TradeNest uses a transparent internal FastAPI rule scorer (`fraud-rules-v1`) with LOW/MEDIUM/HIGH output and reason contributions. HIGH recommends Admin review. The scorer never writes marketplace data.

Authoritative payment processing commits before fraud scoring. The payment webhook then attempts fraud scoring best-effort; an AI outage cannot roll back or invalidate a verified financial transition. AnalyticsModule owns read-only risk-signal aggregation and `fraud_assessments` snapshots. AdminModule owns the ADMIN-only review surface.

First-order amount comparison is same-currency only; no FX conversion is invented. Session-pattern input is limited to server-recorded IP/user-agent churn rather than introducing device fingerprinting.

## Consequences
- Risk is explainable and review-oriented.
- Fraud analysis cannot silently change Payment, Order, Escrow, Inventory, User or Product state.
- A missed AI assessment is operationally visible through logging but does not break provider webhook acknowledgement.
- Thresholds are implementation policy and may evolve with evidence.
- The existing schema and migrations remain unchanged.
