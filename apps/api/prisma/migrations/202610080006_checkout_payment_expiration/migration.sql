-- Pass 05: additive payment deadline; no historical migration is altered.
-- NULL is intentional for pre-existing orders: their provider state must be reconciled
-- before any retrospective inventory release can be permitted.
ALTER TABLE "orders" ADD COLUMN "payment_expires_at" TIMESTAMP(6);
CREATE INDEX "orders_pending_expiry_idx" ON "orders"("status", "payment_expires_at", "id");
