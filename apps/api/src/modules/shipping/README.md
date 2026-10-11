# ShippingModule

Owns shipment persistence and the seller shipment command.

Locked this module behavior:
- Seller creates shipment only for a participating one-seller order.
- Order must be PAID or PROCESSING.
- Escrow must be HELD.
- Shipment creation, Order -> SHIPPED, and Escrow -> SELLER_SHIPPED share one serializable transaction.
- Buyer/Seller participants may read the shipment.
- Buyer delivery confirmation is handled by the dedicated delivery-confirmation/order boundary, not by shipment creation.

Carrier API selection, labels, rates, and provider webhooks are not specified by the blueprint and remain deferred.
