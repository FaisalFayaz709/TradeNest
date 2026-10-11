# Recommendations

TradeNest exposes:

- `GET /api/v1/ai/recommendations?limit=20` — authenticated Buyer personalized recommendations.
- `GET /api/v1/ai/recommendations/products/:id?limit=20` — public similar-product recommendations for an active product.

NestJS remains the only browser-facing API. FastAPI is internal only and has no marketplace database credentials.

## model

This capability upgrades the internal recommendation implementation to `recommendation-hybrid-v2` while preserving existing public contract and module boundaries.

The behavior weights remain the blueprint example values:

- `PRODUCT_VIEW = 1`
- `WISHLIST = 3`
- `ADD_TO_CART = 4`
- `PURCHASE = 8`

Personalized ranking now uses relative recency decay (30-day half-life), logarithmic repetition saturation, word unigram/bigram TF-IDF content similarity, and explicit category affinity. Similar-product ranking blends textual similarity with a bounded same-category signal. pandas and NumPy provide deterministic numeric/ranking work and scikit-learn owns vectorization/similarity.

Cold-start Buyers still receive an empty recommendation set. TradeNest does not invent popularity, demographic, paid-placement, collaborative-filtering, or embedding signals that are not supported by the current blueprint/data flow.

## Authority and persistence

Recommendation scores remain advisory. They cannot mutate Product, Inventory, Cart, Order, Payment, Escrow, Shipping, Dispute, Seller, Review, or Wishlist state. Checkout always reloads authoritative current business state.

The existing `ai_recommendations` table remains optional and is not written by this capability. Results are computed on demand; no schema or migration change is required.
