# ADR-026 — Internal FastAPI recommendation boundary

## Status
Accepted in this decision.

## Decision
NestJS remains the sole public marketplace API. `AIBridgeModule` owns the public recommendation routes and calls FastAPI internally using `AI_SERVICE_URL`. It obtains behavior signals through AnalyticsModule's public API and product features through CatalogModule's public API. FastAPI receives no database credentials and performs no marketplace persistence.

The recommendation MVP computes results on demand rather than using the optional `ai_recommendations` cache. It uses the blueprint's example behavior weights (1/3/4/8), TF-IDF content features, and cosine similarity. Personalized cold start returns an empty set instead of inventing a popularity or demographic fallback.

## Consequences
- browser-to-FastAPI traffic remains prohibited;
- FastAPI owns specialized ML computation only;
- NestJS retains validation, authorization, candidate gathering, and public response authority;
- recommendation output is advisory and cannot mutate critical business state;
- no schema/migration change is needed.

## Deferred
- recommendation cache writes/model refresh jobs;
- seller analytics;
- pricing suggestions;
- fraud scoring;
- improved recommendation models, embeddings, offline training, and experimentation.
