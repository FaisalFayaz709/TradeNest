-- An additive idempotency key for in-transaction, event-sourced in-app notices.
-- Existing notifications retain a NULL key (allowed by the UNIQUE constraint).
ALTER TABLE "notifications" ADD COLUMN "event_key" VARCHAR(200);
CREATE UNIQUE INDEX "notifications_event_key_key" ON "notifications"("event_key");
