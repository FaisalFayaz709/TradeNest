# ADR-025 — Behavior event ingestion stays in AnalyticsModule

## Status
Accepted in this decision.

## Decision
Use the existing `AnalyticsModule` to own public behavior-event ingestion and `user_events` persistence. `POST /api/v1/events` accepts the four blueprint behavior types and a required product ID. Identity is optional at the HTTP boundary: missing Authorization is anonymous, while a supplied Bearer token must authenticate and the server derives `userId` from it.

Catalog remains authoritative for product visibility through a narrow `requireBehaviorEventProduct` public seam. Analytics never queries Catalog persistence directly.

The public event request does not accept arbitrary metadata, timestamps, user IDs, weights, recommendation scores, or business/financial fields. Events are advisory inputs only and cannot mutate transactional marketplace state.

## Why
The blueprint explicitly places user events in the Intelligence scope, stores them in `user_events`, and requires browser traffic to go through NestJS while FastAPI remains internal. The database intentionally permits nullable `user_id`, so anonymous product-view behavior can be retained without inventing a device/session identity model.

## Deferred
- personalized recommendation ranking;
- similar-product ranking;
- FastAPI recommendation inference;
- seller analytics;
- smart-pricing suggestions;
- fraud scoring;
- rate limits/abuse controls are handled by the dedicated hardening layer.
