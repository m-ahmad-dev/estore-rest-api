-- CreateTable
CREATE TABLE "customer_auth_providers" (
    "id" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_auth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_auth_providers_customer_id_idx" ON "customer_auth_providers"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_auth_providers_provider_provider_id_key" ON "customer_auth_providers"("provider", "provider_id");

-- AddForeignKey
ALTER TABLE "customer_auth_providers" ADD CONSTRAINT "customer_auth_providers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
