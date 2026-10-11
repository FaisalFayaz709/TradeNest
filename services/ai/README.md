# TradeNest AI service

This is the internal Python/FastAPI machine-learning service defined by the blueprint. It is not a browser-facing marketplace API.

The AI service adds recommendation inference only:

- `POST /internal/recommendations/personalized`
- `POST /internal/recommendations/similar`

NestJS gathers validated behavior and active-product features through module boundaries and calls these endpoints internally. The MVP uses the blueprint's example behavior weights (`PRODUCT_VIEW=1`, `WISHLIST=3`, `ADD_TO_CART=4`, `PURCHASE=8`) to build a preference profile, then applies TF-IDF content features and cosine similarity using scikit-learn, pandas, and NumPy. Cold-start users receive an empty recommendation set rather than an invented preference profile.

The AI service has no marketplace database connection and no authority to mutate price, inventory, orders, payments, escrow, or seller state.

```bash
python -m venv .venv
# activate the venv
python -m pip install -e ".[dev]"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
python -m pytest
```

The AI service adds `/internal/pricing/suggest` and the transparent `smart-pricing-mvp-v1` heuristic. The service receives server-gathered features and returns an advisory range; it has no marketplace database access.
