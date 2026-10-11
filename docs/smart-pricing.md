# Smart pricing suggestions

This capability implements the blueprint's Advanced AI smart-pricing capability as a **read-only advisory range**. It does not create a new pricing authority and never updates a seller's product price.

## Public API

`GET /api/v1/ai/pricing/products/:id` is Seller-only. The Seller must own the active target product. The route was not explicitly named by the blueprint, so this path is an allowed implementation decision; the locked behavior is the seller-facing advisory pricing capability and the rule that AI must never silently change a price.

## Server-owned feature gathering

NestJS gathers all pricing features before calling FastAPI:

- current product price, category and currency from Catalog;
- active comparable product prices from the same category and currency;
- recorded `PRODUCT_VIEW` and `ADD_TO_CART` demand signals from Analytics;
- authoritative completed-order count and completed units sold from Order history through the Analytics read model.

The browser supplies only the product identifier in the URL. It cannot provide current price, comparable prices, demand counts, sales history, seller ID, category, currency, model weights, or the suggested range.

## MVP model

FastAPI model version `smart-pricing-mvp-v1` uses an intentionally transparent heuristic rather than claiming a trained pricing model without sufficient marketplace history:

1. use the median active comparable price when available, otherwise the current price;
2. blend the comparable reference with the current price, giving more weight to the current price when completed sales history exists;
3. apply a bounded demand adjustment derived from recorded conversion and add-to-cart rates;
4. return a deliberately broad +/-10% advisory range around the adjusted center;
5. clamp suggestions to the locked product-price domain (`0.01` to `99,999,999.00`).

The statistical workload uses pandas and NumPy inside the locked Python/FastAPI AI service. This is advisory analysis, not transaction pricing.

## Authority boundary

The output contains `currentPrice`, a `suggestedRange`, signal summary, model version, generation timestamp and `advisory: true`. There is no exact `recommendedPrice` command and no path from the AI result to `CatalogService.updateProduct()`.

Sellers may separately choose to submit a normal authenticated product update. That existing Catalog command remains the only way a seller changes product price.

## Currency and comparable rules

Comparable products must be active, in the same category, and in the same currency as the target. No FX conversion is invented.

## Deferred

- automatic price application;
- experiments/elasticity models;
- inventory-sensitive repricing;
- competitor scraping;
- fraud scoring (this capability);
- improved recommendation models (this capability).
