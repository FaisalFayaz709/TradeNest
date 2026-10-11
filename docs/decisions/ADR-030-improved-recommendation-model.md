# ADR-030 — Improved recommendation model

## Status
Accepted in this decision.

## Context
The blueprint places "improved recommendation models" in the implementation workstream but does not lock a specific algorithm. This decision already established the public recommendation routes, the NestJS-to-FastAPI boundary, event weights, and a TF-IDF/cosine MVP.

## Decision
Keep the public API and NestJS ownership unchanged and replace only the internal ranking implementation with `recommendation-hybrid-v2`.

The v2 personalized ranker keeps the locked behavior weights (1/3/4/8), then adds:

- relative recency decay with a 30-day half-life;
- logarithmic saturation for repeated events of the same type/product so click volume cannot grow linearly without bound;
- word unigram/bigram TF-IDF content features;
- explicit category-affinity blending with content similarity.

The similar-product ranker blends content similarity with an explicit same-category signal. Cold start still returns an empty set rather than inventing popularity, demographic, sponsored-placement, or cross-user collaborative signals.

## Consequences
- public contracts/routes do not change;
- FastAPI remains internal and database-free;
- recommendation output remains advisory/read-only;
- no cache write, schema change, migration, embedding store, or training pipeline is introduced;
- model quality claims are limited to deterministic behavioral tests in this document, not real-world uplift claims.
