# Shipping contracts

This contract surface defines the blueprint-supported shipment creation/read boundary.
This contract surface extends the backend-owned shipment lifecycle from `SHIPPED` to `DELIVERED` when the owning Buyer confirms delivery.
Carrier and tracking code remain application inputs; shipment status and timestamps remain backend-owned.
Carrier integrations, labels, rates, and carrier webhooks remain outside the contract because the blueprint does not lock them.
