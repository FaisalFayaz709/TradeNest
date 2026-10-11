-- Reusable financial-idempotency claims with request fingerprints.
-- Existing completed records remain valid. Nullable request_hash preserves legacy replay.
ALTER TABLE "idempotency_records"
ADD COLUMN "request_hash" CHAR(64);

-- A new financial write claims its key before side effects, then fills response before COMMIT.
ALTER TABLE "idempotency_records"
ALTER COLUMN "response" DROP NOT NULL;

COMMENT ON COLUMN "idempotency_records"."request_hash" IS
'SHA-256 of canonical financial request intent. NULL only for legacy rows created before request-hash enforcement.';

COMMENT ON COLUMN "idempotency_records"."response" IS
'Original response. NULL only while a new financial operation is claimed inside its uncommitted transaction.';
