# AnalyticsModule

**Boundary responsibility:** behavior-event ingestion and seller analytics.

This module owns `POST /api/v1/events` and `user_events` persistence. This module exposes recent behavior signals through the public module API for the read-only recommendation MVP. This module adds `GET /api/v1/seller/analytics` as an authenticated Seller-only analytical read model.

Seller analytics reads authoritative Order/OrderItem/Product/Inventory/Escrow/UserEvent records but never mutates records owned by those domains. Money is returned as exact decimal strings grouped by currency; no FX conversion is invented. This module also owns fraud-risk signal aggregation and `fraud_assessments` persistence behind the public module API. Fraud scoring itself remains in the internal AIBridge/FastAPI workload, and seller analytics fields remain separate from AI risk output.
