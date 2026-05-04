-- CreateIndex
CREATE INDEX "idx_images_product" ON "product_images"("product_id");

-- CreateIndex
CREATE INDEX "idx_images_primary" ON "product_images"("product_id", "is_primary");

-- CreateIndex
CREATE INDEX "idx_images_sort" ON "product_images"("product_id", "sort_order");

-- CreateIndex
CREATE INDEX "idx_variants_attributes" ON "product_variants"("product_id", "size", "color");

-- CreateIndex
CREATE INDEX "idx_variants_stock" ON "product_variants"("stock_quantity");

-- CreateIndex
CREATE INDEX "idx_variants_price" ON "product_variants"("price");

-- CreateIndex
CREATE INDEX "idx_variants_inventory" ON "product_variants"("stock_quantity", "reserved_quantity");

-- CreateIndex
CREATE INDEX "idx_products_active" ON "products"("is_active");

-- CreateIndex
CREATE INDEX "idx_products_created_at" ON "products"("created_at");

-- CreateIndex
CREATE INDEX "idx_products_deleted_at" ON "products"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_products_category_active" ON "products"("category_id", "is_active");
