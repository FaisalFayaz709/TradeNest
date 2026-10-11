# AIBridgeModule

**Boundary responsibility:** NestJS-to-FastAPI integration boundary.

This module owns the NestJS-to-FastAPI boundary for recommendations, smart pricing, and fraud-risk scoring.

- Browser-facing routes live in NestJS: `/api/v1/ai/recommendations` and `/api/v1/ai/recommendations/products/:id`.
- NestJS reads behavior and catalog data through AnalyticsModule/CatalogModule public seams.
- `AiServiceClient` calls FastAPI's internal `/internal/recommendations/*` endpoints.
- AIBridgeModule contains no Prisma access.
- FastAPI has no marketplace database connection.
- Recommendation scores are advisory and cannot mutate critical business state.

Seller analytics remains owned by AnalyticsModule. Smart pricing, fraud scoring, and the improved recommendation model are available through this internal AI bridge without moving marketplace authority into FastAPI.

This module adds Seller-only smart pricing through `GET /api/v1/ai/pricing/products/:id`. NestJS gathers authoritative features and FastAPI returns an advisory range only; AIBridge has no business-state mutation authority.


This module adds the internal fraud-risk scoring bridge. Payments invokes it only after an authoritative terminal webhook transition commits. The bridge gathers read-only signals through AnalyticsModule, calls `/internal/fraud/score`, and asks AnalyticsModule to persist the resulting assessment. It cannot mutate Payment, Order, Escrow, User, Catalog, or Inventory state.

This module upgrades only the internal recommendation ranker to `recommendation-hybrid-v2`. The public routes/contracts and NestJS ownership remain unchanged; FastAPI stays read-only and internal.
