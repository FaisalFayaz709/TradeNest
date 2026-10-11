-- Pass 8: enforce existing single-seller MVP's one-shipment-per-order invariant.
-- Intentional fail-closed migration: existing duplicate/invalid shipment rows must be
-- investigated and repaired manually; NEVER delete financial/fulfillment history here.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM shipments GROUP BY order_id HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'PASS8_DUPLICATE_SHIPMENTS_REQUIRES_MANUAL_RECONCILIATION';
  END IF;
  IF EXISTS (
    SELECT 1 FROM shipments WHERE
      carrier IS NULL OR BTRIM(carrier) = '' OR
      tracking_code IS NULL OR BTRIM(tracking_code) = '' OR
      shipped_at IS NULL OR status NOT IN ('SHIPPED','DELIVERED') OR
      (status = 'SHIPPED' AND delivered_at IS NOT NULL) OR
      (status = 'DELIVERED' AND delivered_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'PASS8_INVALID_SHIPMENT_STATE_REQUIRES_MANUAL_RECONCILIATION';
  END IF;
END $$;

ALTER TABLE "shipments" ALTER COLUMN "carrier" SET NOT NULL;
ALTER TABLE "shipments" ALTER COLUMN "tracking_code" SET NOT NULL;
ALTER TABLE "shipments" ALTER COLUMN "shipped_at" SET NOT NULL;
CREATE UNIQUE INDEX "shipments_order_id_key" ON "shipments"("order_id");
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_valid_state_check"
CHECK (
  BTRIM("carrier") <> '' AND BTRIM("tracking_code") <> '' AND
  (("status" = 'SHIPPED' AND "delivered_at" IS NULL) OR
   ("status" = 'DELIVERED' AND "delivered_at" IS NOT NULL))
);
