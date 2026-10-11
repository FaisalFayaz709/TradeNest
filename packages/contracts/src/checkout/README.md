# Checkout contracts

This contract surface defines only the authoritative checkout quote response contract.

There is intentionally no client-supplied trusted price, subtotal, shipping amount,
discount amount, total, product status, seller status, or inventory value. The
backend derives all quote values from current authoritative state.

`inventoryReserved` is always `false` in this contract surface because quoting does not reserve
stock. Reservation is owned by transactional checkout.
