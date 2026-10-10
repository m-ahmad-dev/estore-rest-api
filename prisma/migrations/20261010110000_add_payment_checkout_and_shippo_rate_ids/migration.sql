ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "checkout_session_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "checkout_url" VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "attempt_id" VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS "payments_checkout_session_id_key"
  ON "payments"("checkout_session_id");

ALTER TABLE "shipments"
  ADD COLUMN IF NOT EXISTS "rate_id" VARCHAR(255);


ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'PURCHASING_LABEL';

ALTER TABLE "shipments"
  ADD COLUMN IF NOT EXISTS "label_purchase_started_at" TIMESTAMP(6);
