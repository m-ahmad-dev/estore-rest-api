CREATE UNIQUE INDEX uq_product_primary_image ON product_images (product_id)
WHERE
  is_primary = true;

CREATE UNIQUE INDEX unique_active_customer_cart ON carts (customer_id)
WHERE
  status = 'ACTIVE';

CREATE UNIQUE INDEX unique_active_session_cart ON carts (session_id)
WHERE
  status = 'ACTIVE';

ALTER TABLE cart_items ADD CONSTRAINT cart_items_quantity_positive CHECK (quantity > 0);

-- Covers cleanupExpiredGuestCarts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_carts_guest_expires_at ON carts (expires_at)
WHERE
  customer_id IS NULL
  AND expires_at IS NOT NULL;

-- Covers both markAbandoned and deleteAbandoned (reused)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_carts_customer_status_updated ON carts (customer_id, status, updated_at)
WHERE
  customer_id IS NOT NULL;

--==== HANDLE FULL-TEXT-SEARCH ====--

-- Add the search vector column
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Main GIN index for full-text search on reviews
CREATE INDEX IF NOT EXISTS idx_reviews_search 
    ON reviews USING GIN(search_vector);

-- Supporting indexes 
CREATE INDEX IF NOT EXISTS idx_products_name_fts 
    ON products USING GIN (to_tsvector('english', name));

CREATE INDEX IF NOT EXISTS idx_customers_name_fts 
    ON customers USING GIN (
        to_tsvector('english', COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
    );

--  Trigger function
CREATE OR REPLACE FUNCTION reviews_update_search_vector()
RETURNS TRIGGER AS $$
DECLARE
    p_name      TEXT;
    c_firstname TEXT;
    c_lastname  TEXT;
BEGIN
    -- Fetch related data
    SELECT name 
    INTO p_name 
    FROM products 
    WHERE id = NEW.product_id;

    SELECT first_name, last_name 
    INTO c_firstname, c_lastname 
    FROM customers 
    WHERE id = NEW.customer_id;

    -- Build weighted search vector
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.comment, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(p_name, '')), 'C') ||
        setweight(to_tsvector('english', 
            COALESCE(c_firstname, '') || ' ' || COALESCE(c_lastname, '')), 'D');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger

CREATE TRIGGER trg_reviews_search_vector_update
    BEFORE INSERT OR UPDATE ON reviews
    FOR EACH ROW 
    EXECUTE FUNCTION reviews_update_search_vector();

    -- =========================== --