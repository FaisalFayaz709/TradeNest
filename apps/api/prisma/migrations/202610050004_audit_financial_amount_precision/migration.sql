-- Financial amount precision hardening.
--
-- The locked CreateProduct contract permits price up to 99,999,999 and stock
-- up to 1,000,000. A valid single line can therefore reach
-- 99,999,999,000,000.00, which exceeds NUMERIC(12,2).
-- Product unit price remains NUMERIC(12,2) as specified by the blueprint;
-- aggregate/order/payment/escrow amounts are widened because the blueprint
-- specifies them as NUMERIC without a narrower precision.

ALTER TABLE "orders"
  ALTER COLUMN "subtotal" TYPE NUMERIC(30,2),
  ALTER COLUMN "shipping_amount" TYPE NUMERIC(30,2),
  ALTER COLUMN "discount_amount" TYPE NUMERIC(30,2),
  ALTER COLUMN "total_amount" TYPE NUMERIC(30,2);

ALTER TABLE "order_items"
  ALTER COLUMN "total_price" TYPE NUMERIC(30,2);

ALTER TABLE "payments"
  ALTER COLUMN "amount" TYPE NUMERIC(30,2);

ALTER TABLE "escrows"
  ALTER COLUMN "amount" TYPE NUMERIC(30,2);

ALTER TABLE "escrow_transactions"
  ALTER COLUMN "amount" TYPE NUMERIC(30,2);
