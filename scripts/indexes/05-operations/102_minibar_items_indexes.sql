-- =====================================================
-- Indexes for minibar_items table
-- =====================================================

\c tartware

\echo 'Creating indexes for minibar_items...'

-- Primary lookup indexes
CREATE INDEX idx_minibar_items_tenant_property ON minibar_items(tenant_id, property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_items_code ON minibar_items(tenant_id, property_id, item_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_items_name ON minibar_items(property_id, item_name) WHERE is_deleted = FALSE;

-- Category indexes
CREATE INDEX idx_minibar_items_category ON minibar_items(property_id, category, is_active) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_items_subcategory ON minibar_items(property_id, category, subcategory, is_active) WHERE is_deleted = FALSE;

-- Active items
CREATE INDEX idx_minibar_items_active ON minibar_items(property_id, is_active) WHERE is_deleted = FALSE AND is_active = TRUE;

-- Alcohol items
CREATE INDEX idx_minibar_items_alcoholic ON minibar_items(property_id, is_alcoholic, is_active) WHERE is_deleted = FALSE AND is_alcoholic = TRUE;

-- Pricing indexes
CREATE INDEX idx_minibar_items_price ON minibar_items(property_id, base_price, is_active) WHERE is_deleted = FALSE;

-- Inventory indexes
CREATE INDEX idx_minibar_items_stock ON minibar_items(property_id, current_stock_quantity, track_inventory) WHERE is_deleted = FALSE AND track_inventory = TRUE;
CREATE INDEX idx_minibar_items_reorder ON minibar_items(property_id, current_stock_quantity, reorder_point) WHERE is_deleted = FALSE AND track_inventory = TRUE AND current_stock_quantity <= reorder_point;
CREATE INDEX idx_minibar_items_low_stock ON minibar_items(property_id) WHERE is_deleted = FALSE AND track_inventory = TRUE AND current_stock_quantity < par_level_per_room * 5;

-- Barcode lookup
CREATE INDEX idx_minibar_items_barcode ON minibar_items(barcode) WHERE is_deleted = FALSE AND barcode IS NOT NULL;

-- Supplier linkage
CREATE INDEX idx_minibar_items_supplier ON minibar_items(supplier_id) WHERE is_deleted = FALSE;

-- Seasonal items
CREATE INDEX idx_minibar_items_seasonal ON minibar_items(property_id, seasonal, season) WHERE is_deleted = FALSE AND seasonal = TRUE;
CREATE INDEX idx_minibar_items_availability ON minibar_items(property_id, available_from_date, available_to_date) WHERE is_deleted = FALSE;

-- Dietary filters
CREATE INDEX idx_minibar_items_vegetarian ON minibar_items(property_id, is_vegetarian) WHERE is_deleted = FALSE AND is_vegetarian = TRUE;
CREATE INDEX idx_minibar_items_vegan ON minibar_items(property_id, is_vegan) WHERE is_deleted = FALSE AND is_vegan = TRUE;
CREATE INDEX idx_minibar_items_gluten_free ON minibar_items(property_id, is_gluten_free) WHERE is_deleted = FALSE AND is_gluten_free = TRUE;
CREATE INDEX idx_minibar_items_allergens ON minibar_items(property_id, contains_allergens) WHERE is_deleted = FALSE AND contains_allergens = TRUE;

-- Temperature requirements
CREATE INDEX idx_minibar_items_temp_req ON minibar_items(property_id, storage_temp_required, is_active) WHERE is_deleted = FALSE;

-- Featured/upsell items
CREATE INDEX idx_minibar_items_featured ON minibar_items(property_id, featured, display_order) WHERE is_deleted = FALSE AND featured = TRUE AND is_active = TRUE;
CREATE INDEX idx_minibar_items_upsell ON minibar_items(property_id, upsell_item) WHERE is_deleted = FALSE AND upsell_item = TRUE AND is_active = TRUE;

-- Integration indexes
CREATE INDEX idx_minibar_items_pos ON minibar_items(pos_item_id) WHERE is_deleted = FALSE AND pos_item_id IS NOT NULL;
CREATE INDEX idx_minibar_items_accounting ON minibar_items(accounting_code, gl_account) WHERE is_deleted = FALSE;

-- Popularity/reporting
CREATE INDEX idx_minibar_items_popularity ON minibar_items(property_id, popularity_score DESC) WHERE is_deleted = FALSE AND is_active = TRUE;

-- JSONB indexes (GIN)
CREATE INDEX idx_minibar_items_pricing_tiers_gin ON minibar_items USING GIN (pricing_tiers) WHERE is_deleted = FALSE;
CREATE INDEX idx_minibar_items_metadata_gin ON minibar_items USING GIN (metadata) WHERE is_deleted = FALSE;

-- Audit indexes
CREATE INDEX idx_minibar_items_created ON minibar_items(created_at);
CREATE INDEX idx_minibar_items_updated ON minibar_items(updated_at);

\echo 'Indexes for minibar_items created successfully!'
