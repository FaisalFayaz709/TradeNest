-- TradeNest database foundation
-- PostgreSQL 18 / Prisma ORM 7
--
-- LOCKED integrity rules from the Technical Blueprint are enforced here,
-- including CHECK constraints that Prisma 7 cannot express in schema.prisma.

CREATE TYPE "user_role" AS ENUM ('BUYER', 'SELLER', 'ADMIN');
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'SUSPENDED');
CREATE TYPE "order_status" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'REFUNDED');
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "escrow_status" AS ENUM ('PENDING', 'HELD', 'SELLER_SHIPPED', 'BUYER_CONFIRMED', 'RELEASED', 'DISPUTED', 'UNDER_REVIEW', 'REFUNDED');
CREATE TYPE "escrow_transaction_type" AS ENUM ('HOLD', 'RELEASE', 'REFUND', 'ADJUSTMENT');
CREATE TYPE "dispute_status" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "dispute_resolution" AS ENUM ('REFUND_BUYER', 'RELEASE_TO_SELLER');
CREATE TYPE "behavior_event_type" AS ENUM ('PRODUCT_VIEW', 'WISHLIST', 'ADD_TO_CART', 'PURCHASE');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "role" "user_role" NOT NULL,
  "status" "user_status" NOT NULL,
  "email_verified_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "refresh_token_hash" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMP(6) NOT NULL,
  "revoked_at" TIMESTAMP(6),
  "ip_address" VARCHAR(64),
  "user_agent" TEXT,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "seller_profiles" (
  "user_id" UUID NOT NULL,
  "store_name" VARCHAR(200) NOT NULL,
  "slug" VARCHAR(220) NOT NULL,
  "status" VARCHAR(32) NOT NULL,
  "rating" DECIMAL(3,2),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "addresses" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "label" VARCHAR(100),
  "recipient" VARCHAR(200) NOT NULL,
  "line1" VARCHAR(255) NOT NULL,
  "line2" VARCHAR(255),
  "city" VARCHAR(120) NOT NULL,
  "region" VARCHAR(120),
  "postal_code" VARCHAR(32),
  "country" CHAR(2) NOT NULL,
  "phone" VARCHAR(40),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "categories" (
  "id" UUID NOT NULL,
  "parent_id" UUID,
  "name" VARCHAR(200) NOT NULL,
  "slug" VARCHAR(220) NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
  "id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "slug" VARCHAR(240) NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "status" "product_status" NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_price_nonnegative_check" CHECK ("price" >= 0)
);

CREATE TABLE "product_images" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "object_key" VARCHAR(1024) NOT NULL,
  "url" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory" (
  "product_id" UUID NOT NULL,
  "available_quantity" INTEGER NOT NULL,
  "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_pkey" PRIMARY KEY ("product_id"),
  CONSTRAINT "inventory_available_nonnegative_check" CHECK ("available_quantity" >= 0),
  CONSTRAINT "inventory_reserved_nonnegative_check" CHECK ("reserved_quantity" >= 0)
);

CREATE TABLE "carts" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cart_items" (
  "id" UUID NOT NULL,
  "cart_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
  "id" UUID NOT NULL,
  "order_number" VARCHAR(64) NOT NULL,
  "buyer_id" UUID NOT NULL,
  "status" "order_status" NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "shipping_amount" DECIMAL(12,2) NOT NULL,
  "discount_amount" DECIMAL(12,2) NOT NULL,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "shipping_address" JSONB NOT NULL,
  "paid_at" TIMESTAMP(6),
  "completed_at" TIMESTAMP(6),
  "cancelled_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "product_name" VARCHAR(200) NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_price" DECIMAL(12,2) NOT NULL,
  "total_price" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_items_quantity_positive_check" CHECK ("quantity" > 0)
);

CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "buyer_id" UUID NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "provider_payment_id" VARCHAR(255) NOT NULL,
  "status" "payment_status" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "failure_code" VARCHAR(128),
  "failure_message" TEXT,
  "paid_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_amount_positive_check" CHECK ("amount" > 0)
);

CREATE TABLE "escrows" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "status" "escrow_status" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "held_at" TIMESTAMP(6),
  "released_at" TIMESTAMP(6),
  "refunded_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "escrows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "escrow_transactions" (
  "id" UUID NOT NULL,
  "escrow_id" UUID NOT NULL,
  "type" "escrow_transaction_type" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reference" VARCHAR(255),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "escrow_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipments" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "carrier" VARCHAR(120),
  "tracking_code" VARCHAR(255),
  "status" VARCHAR(32) NOT NULL,
  "shipped_at" TIMESTAMP(6),
  "delivered_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "disputes" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "buyer_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "reason" VARCHAR(255) NOT NULL,
  "description" TEXT NOT NULL,
  "status" "dispute_status" NOT NULL,
  "resolution" "dispute_resolution",
  "resolved_by" UUID,
  "opened_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(6),
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dispute_messages" (
  "id" UUID NOT NULL,
  "dispute_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dispute_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dispute_evidence" (
  "id" UUID NOT NULL,
  "dispute_id" UUID NOT NULL,
  "uploaded_by_id" UUID NOT NULL,
  "object_key" VARCHAR(1024) NOT NULL,
  "url" TEXT NOT NULL,
  "file_name" VARCHAR(255),
  "mime_type" VARCHAR(120),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wishlist_items" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reviews" (
  "id" UUID NOT NULL,
  "order_item_id" UUID NOT NULL,
  "buyer_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reviews_rating_range_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE TABLE "user_events" (
  "id" UUID NOT NULL,
  "user_id" UUID,
  "product_id" UUID,
  "event_type" "behavior_event_type" NOT NULL,
  "metadata" JSONB,
  "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_recommendations" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "score" DECIMAL(12,6) NOT NULL,
  "model_version" VARCHAR(128) NOT NULL,
  "generated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fraud_assessments" (
  "id" UUID NOT NULL,
  "user_id" UUID,
  "order_id" UUID,
  "payment_id" UUID,
  "risk_score" DECIMAL(8,4) NOT NULL,
  "risk_level" VARCHAR(32) NOT NULL,
  "reasons" JSONB NOT NULL,
  "model_version" VARCHAR(128) NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fraud_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "type" VARCHAR(64) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "body" TEXT NOT NULL,
  "read_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL,
  "actor_id" UUID,
  "action" VARCHAR(128) NOT NULL,
  "entity_type" VARCHAR(128) NOT NULL,
  "entity_id" UUID,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "request_id" VARCHAR(128),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Blueprint-locked uniqueness / identity guarantees.
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE UNIQUE INDEX "cart_items_cart_product_key" ON "cart_items"("cart_id", "product_id");
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments"("provider_payment_id");
CREATE UNIQUE INDEX "escrows_order_id_key" ON "escrows"("order_id");
CREATE UNIQUE INDEX "disputes_order_id_key" ON "disputes"("order_id");
CREATE UNIQUE INDEX "wishlist_items_user_product_key" ON "wishlist_items"("user_id", "product_id");
CREATE UNIQUE INDEX "reviews_order_item_id_key" ON "reviews"("order_item_id");

-- Blueprint says one active cart per user. Partial uniqueness is a PostgreSQL
-- implementation choice because Prisma's model-level unique syntax cannot express
-- this exact invariant without constraining inactive carts as well.
CREATE UNIQUE INDEX "carts_one_active_per_user_key"
  ON "carts"("user_id") WHERE "is_active" = true;

-- Blueprint-required / blueprint-directed indexes.
CREATE INDEX "user_sessions_user_expiry_idx" ON "user_sessions"("user_id", "expires_at");
CREATE INDEX "seller_profiles_status_idx" ON "seller_profiles"("status");
CREATE INDEX "addresses_user_idx" ON "addresses"("user_id");
CREATE INDEX "categories_parent_idx" ON "categories"("parent_id");
CREATE INDEX "products_seller_status_idx" ON "products"("seller_id", "status");
CREATE INDEX "products_category_status_idx" ON "products"("category_id", "status");
CREATE INDEX "products_status_idx" ON "products"("status");
CREATE INDEX "product_images_product_order_idx" ON "product_images"("product_id", "sort_order");
CREATE INDEX "carts_user_idx" ON "carts"("user_id");
CREATE INDEX "cart_items_product_idx" ON "cart_items"("product_id");
CREATE INDEX "orders_buyer_status_created_idx" ON "orders"("buyer_id", "status", "created_at");
CREATE INDEX "orders_status_created_idx" ON "orders"("status", "created_at");
CREATE INDEX "order_items_order_idx" ON "order_items"("order_id");
CREATE INDEX "order_items_seller_idx" ON "order_items"("seller_id");
CREATE INDEX "order_items_product_idx" ON "order_items"("product_id");
CREATE INDEX "payments_order_status_idx" ON "payments"("order_id", "status");
CREATE INDEX "payments_buyer_created_idx" ON "payments"("buyer_id", "created_at");
CREATE INDEX "escrows_order_status_idx" ON "escrows"("order_id", "status");
CREATE INDEX "escrows_status_idx" ON "escrows"("status");
CREATE INDEX "escrow_transactions_escrow_created_idx" ON "escrow_transactions"("escrow_id", "created_at");
CREATE INDEX "shipments_status_idx" ON "shipments"("status");
CREATE INDEX "disputes_status_idx" ON "disputes"("status");
CREATE INDEX "disputes_buyer_idx" ON "disputes"("buyer_id");
CREATE INDEX "disputes_seller_idx" ON "disputes"("seller_id");
CREATE INDEX "dispute_messages_dispute_created_idx" ON "dispute_messages"("dispute_id", "created_at");
CREATE INDEX "dispute_evidence_dispute_created_idx" ON "dispute_evidence"("dispute_id", "created_at");
CREATE INDEX "wishlist_items_product_idx" ON "wishlist_items"("product_id");
CREATE INDEX "reviews_product_created_idx" ON "reviews"("product_id", "created_at");
CREATE INDEX "user_events_user_type_time_idx" ON "user_events"("user_id", "event_type", "occurred_at");
CREATE INDEX "user_events_product_type_time_idx" ON "user_events"("product_id", "event_type", "occurred_at");
CREATE INDEX "user_events_type_time_idx" ON "user_events"("event_type", "occurred_at");
CREATE INDEX "ai_recommendations_user_generated_idx" ON "ai_recommendations"("user_id", "generated_at");
CREATE INDEX "ai_recommendations_product_idx" ON "ai_recommendations"("product_id");
CREATE INDEX "fraud_assessments_user_created_idx" ON "fraud_assessments"("user_id", "created_at");
CREATE INDEX "fraud_assessments_order_idx" ON "fraud_assessments"("order_id");
CREATE INDEX "fraud_assessments_payment_idx" ON "fraud_assessments"("payment_id");
CREATE INDEX "fraud_assessments_level_created_idx" ON "fraud_assessments"("risk_level", "created_at");
CREATE INDEX "notifications_user_read_created_idx" ON "notifications"("user_id", "read_at", "created_at");
CREATE INDEX "audit_logs_actor_created_idx" ON "audit_logs"("actor_id", "created_at");
CREATE INDEX "audit_logs_entity_created_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");
CREATE INDEX "audit_logs_action_created_idx" ON "audit_logs"("action", "created_at");

-- Foreign keys. Financial/history records are intentionally RESTRICT/NO ACTION;
-- ephemeral owned records use CASCADE only where deleting the owner is safe.
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_escrow_id_fkey" FOREIGN KEY ("escrow_id") REFERENCES "escrows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fraud_assessments" ADD CONSTRAINT "fraud_assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fraud_assessments" ADD CONSTRAINT "fraud_assessments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fraud_assessments" ADD CONSTRAINT "fraud_assessments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Audit hardening: apply the blueprint's generic quantity/rating integrity rules
-- to every persisted cart quantity and seller rating field as well.
ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_quantity_positive_check" CHECK ("quantity" > 0);
ALTER TABLE "seller_profiles"
  ADD CONSTRAINT "seller_profiles_rating_range_check" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);

