# Reviews

## Blueprint scope

This capability implements the two review endpoints from the blueprint:

- `GET /api/v1/products/:id/reviews` — public review collection.
- `POST /api/v1/orders/:orderId/reviews` — verified Buyer review creation.

The business rule is exact: only a Buyer with a **completed purchased order item** may review that product, rating is 1–5, and the database enforces one review per purchased order item.

## Module ownership

The locked modular-monolith module list does not define a separate Reviews module. Reviews therefore live as a feature inside `OrdersModule`, because verified-purchase eligibility is derived from immutable `OrderItem` snapshots. This avoids inventing a new marketplace module or creating a Catalog↔Orders dependency cycle.

`ReviewsRepository` owns only `reviews` persistence. Purchase eligibility is read through `OrdersRepository` inside the same Orders module.

## Create contract

The request is:

```json
{
  "orderItemId": "uuid",
  "rating": 5,
  "comment": "optional text"
}
```

`productId` and `buyerId` are never accepted from the client. They are derived from the authenticated Buyer and the purchased OrderItem.

The blueprint does not specify a comment-length rule, so this capability does not invent one. Empty/whitespace comments normalize to `null`.

## Public response privacy

Public review objects contain:

- review ID;
- product ID;
- rating;
- optional comment;
- created/updated timestamps.

They intentionally do not expose Buyer IDs or OrderItem IDs.

## Eligibility and duplicate behavior

Creation requires:

1. authenticated role `BUYER`;
2. the path Order belongs to that Buyer;
3. `orderItemId` belongs to that Order;
4. Order status is exactly `COMPLETED`;
5. no existing Review references that OrderItem.

A non-owned/mismatched purchase is concealed as `404 ORDER_ITEM_NOT_FOUND`.
An incomplete order returns `409 REVIEW_NOT_ELIGIBLE`.
A second review for the same purchased OrderItem returns `409 REVIEW_ALREADY_EXISTS`.

The PostgreSQL `UNIQUE(order_item_id)` and rating `CHECK 1..5` constraints remain the final integrity boundary.

## Deferred

This capability does not implement Wishlist, seller-rating aggregation, review editing/deletion, moderation, helpful votes, media uploads, or AI review analysis because none are part of this document's locked scope.
