# AdminModule

**Boundary responsibility:** admin-facing coordination and policy boundary.

This module activates the blueprint's `GET /api/v1/admin/fraud-alerts` review surface. AdminModule owns the Admin authorization/presentation boundary but does not own marketplace persistence. Fraud-assessment persistence and analytical signals remain behind AnalyticsModule's public API, while AIBridgeModule owns the internal FastAPI scoring boundary.

Fraud alerts are review-oriented signals only. They do not block accounts, cancel orders, fail payments, refund/release escrow, or otherwise mutate critical business state.
