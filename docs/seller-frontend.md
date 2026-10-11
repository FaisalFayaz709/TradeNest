# Seller frontend

This capability implements the blueprint Seller page family as a Next.js workspace backed by the existing NestJS modular monolith.

The browser uses the same-origin TradeNest BFF and HttpOnly session cookies introduced in this capability. Seller routes are explicitly allowlisted. Admin routes remain unavailable through the web proxy.

Seller UI responsibilities are display state, forms, UX validation and API requests. NestJS continues to own seller activation policy, product ownership, lifecycle transitions, inventory reservation truth, order eligibility, shipment transitions, escrow state, dispute participation and AI pricing authorization.

Two read endpoints are added because the existing source lacked collections required by the runtime Seller experience:

- `GET /api/v1/seller/orders` in OrdersModule, scoped by immutable order-item `sellerId`.
- `GET /api/v1/seller/disputes` in DisputesModule, scoped by persisted dispute `sellerId`.

The Payments page deliberately does not invent a Seller payment-detail/list endpoint. Existing payment detail is Buyer/Admin scoped, so Seller financial visibility is expressed through released revenue and escrow analytics.
