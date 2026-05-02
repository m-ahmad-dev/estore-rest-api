-- DropIndex
DROP INDEX "PasswordReset_customer_id_idx";

-- CreateIndex
CREATE INDEX "PasswordReset_customer_id_token_hash_idx" ON "PasswordReset"("customer_id", "token_hash");
