-- CreateIndex
CREATE INDEX "idx_categories_parent" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "idx_categories_slug" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "idx_categories_name" ON "categories"("name");
