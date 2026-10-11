# ADR-028 — Smart pricing remains advisory and seller-controlled

## Status
Accepted in this decision.

## Context
The blueprint permits AI pricing suggestions based on category, demand, views, conversion, sales history and comparable products, but explicitly forbids the AI from silently changing seller prices. It does not define a public route, pricing provider, trained model, elasticity threshold, or automatic application workflow.

## Decision
TradeNest exposes `GET /api/v1/ai/pricing/products/:id` to the owning Seller. NestJS gathers authoritative product/comparable data through CatalogModule and read-only demand/sales features through AnalyticsModule, then calls FastAPI internally. FastAPI returns only an advisory range with model metadata.

The MVP model is a transparent heuristic (`smart-pricing-mvp-v1`) using comparable median, completed sales history, and bounded demand ratios. The service does not persist suggestions and does not call any Catalog mutation command. Comparable prices are restricted to the same currency; no FX conversion is introduced.

## Consequences
- Seller remains the only actor who may explicitly change a product price through the normal Catalog update command.
- Browser clients cannot inject pricing features or model parameters.
- FastAPI remains specialized, read-only compute with no marketplace database credentials.
- No schema or migration change is needed.
- Pricing suggestions are visually/semantically distinct AI insight, not authoritative seller analytics.

## Deferred
Fraud scoring, improved recommendation models, automatic experiments, demand forecasting, and any price auto-application mechanism.
