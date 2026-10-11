# API Conventions

Source: TradeNest Technical Blueprint §5.

## Base rules

- Base path: `/api/v1`
- Request/response format: JSON
- Authenticated requests: Bearer JWT access token
- API documentation: OpenAPI/Swagger exposed by NestJS
- Financial write operations: support `Idempotency-Key`
- Frontend requests actions; it does not declare authoritative order/financial state

## Standard success response

```json
{
  "data": {
    "id": "..."
  }
}
```

## Collection response

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 130,
    "totalPages": 7
  }
}
```

## Standard error

```json
{
  "error": {
    "code": "PRODUCT_OUT_OF_STOCK",
    "message": "The requested quantity is not available.",
    "details": { "productId": "..." },
    "requestId": "req_..."
  }
}
```

## API authority rule

The presence of a syntactically valid status enum in a request does not make a transition legal. Domain services/state machines determine whether the action is allowed.

## Blueprint endpoint inventory

The blueprint specifies endpoint families for:

- authentication;
- users and addresses;
- seller profile/dashboard;
- categories/products;
- cart/checkout;
- orders/shipping/payments/escrow;
- disputes/reviews/wishlist;
- AI/analytics/admin.

These conventions and boundaries apply to the implemented controllers and services.

## Financial-write idempotency

For operations such as checkout/payment/refund/release, the request should carry an idempotency key and the backend should return the original result on safe retry rather than duplicate the financial operation.
