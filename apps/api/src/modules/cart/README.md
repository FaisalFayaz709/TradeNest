# CartModule

Owns buyer cart state (`carts`, `cart_items`) and the `/api/v1/cart` API family.

Rules:
- Buyer authentication/role is required.
- Only one active cart may exist per user; PostgreSQL's partial unique index is the final concurrency-safe guarantee.
- Cart-item ownership is enforced by always scoping mutations to the authenticated buyer's active cart.
- A cart is convenience state, not a price or inventory guarantee.
- Cart records contain product identity and quantity only; no authoritative prices or totals are stored here.
- Adding a product asks CatalogModule through its public seam whether the product is currently ACTIVE. CartModule never reads Product persistence directly.
- Cart actions never reserve inventory. Reservation belongs to checkout.
