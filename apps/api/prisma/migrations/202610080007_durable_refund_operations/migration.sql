-- New append-only migration: durable refundable obligation and lease.
CREATE TABLE "refund_operations" (
  "id" UUID PRIMARY KEY,
  "escrow_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "dispute_id" UUID,
  "provider" VARCHAR(64) NOT NULL,
  "amount" DECIMAL(30,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'READY',
  "provider_refund_id" VARCHAR(255),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lease_until" TIMESTAMP(6),
  "retry_after" TIMESTAMP(6),
  "last_error" VARCHAR(128),
  "request_id" VARCHAR(128),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refund_operations_amount_positive_check" CHECK ("amount" > 0),
  CONSTRAINT "refund_operations_attempts_nonnegative_check" CHECK ("attempts" >= 0),
  CONSTRAINT "refund_operations_status_check" CHECK ("status" IN ('READY','IN_FLIGHT','PROVIDER_PENDING','SUCCEEDED','NEEDS_REVIEW')),
  CONSTRAINT "refund_operations_escrow_fk" FOREIGN KEY ("escrow_id") REFERENCES "escrows"("id") ON DELETE RESTRICT,
  CONSTRAINT "refund_operations_payment_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT,
  CONSTRAINT "refund_operations_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "refund_operations_dispute_fk" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "refund_operations_escrow_key" ON "refund_operations"("escrow_id");
CREATE UNIQUE INDEX "refund_operations_provider_refund_key" ON "refund_operations"("provider_refund_id");
CREATE INDEX "refund_operations_worker_idx" ON "refund_operations"("status","retry_after","lease_until");
CREATE INDEX "refund_operations_payment_idx" ON "refund_operations"("payment_id");
CREATE INDEX "refund_operations_actor_idx" ON "refund_operations"("actor_id");
CREATE INDEX "refund_operations_dispute_idx" ON "refund_operations"("dispute_id");
