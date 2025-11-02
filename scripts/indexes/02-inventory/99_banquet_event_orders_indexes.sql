-- =====================================================
-- Indexes for banquet_event_orders table
-- =====================================================

\c tartware

\echo 'Creating indexes for banquet_event_orders...'

-- Primary lookup indexes
CREATE INDEX idx_beo_tenant_property ON banquet_event_orders(tenant_id, property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_beo_event_booking ON banquet_event_orders(event_booking_id, beo_version) WHERE is_deleted = FALSE;
CREATE INDEX idx_beo_number ON banquet_event_orders(tenant_id, property_id, beo_number) WHERE is_deleted = FALSE;

-- Status indexes
CREATE INDEX idx_beo_status ON banquet_event_orders(property_id, beo_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_beo_pending_approval ON banquet_event_orders(property_id, beo_status) WHERE is_deleted = FALSE AND beo_status = 'PENDING_APPROVAL';
CREATE INDEX idx_beo_in_progress ON banquet_event_orders(property_id, event_date, beo_status) WHERE is_deleted = FALSE AND beo_status = 'IN_PROGRESS';

-- Date indexes
CREATE INDEX idx_beo_event_date ON banquet_event_orders(property_id, event_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_beo_upcoming ON banquet_event_orders(property_id, event_date, beo_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_beo_today ON banquet_event_orders(property_id, event_date) WHERE is_deleted = FALSE;

-- Room linkage
CREATE INDEX idx_beo_meeting_room ON banquet_event_orders(meeting_room_id, event_date) WHERE is_deleted = FALSE;

-- Approval tracking
CREATE INDEX idx_beo_client_approval ON banquet_event_orders(property_id, client_approved, event_date) WHERE is_deleted = FALSE AND client_approved = FALSE;
CREATE INDEX idx_beo_chef_approval ON banquet_event_orders(property_id, chef_approved, event_date) WHERE is_deleted = FALSE AND chef_approved = FALSE;
CREATE INDEX idx_beo_manager_approval ON banquet_event_orders(property_id, manager_approved, event_date) WHERE is_deleted = FALSE AND manager_approved = FALSE;

-- Execution tracking indexes
CREATE INDEX idx_beo_setup_pending ON banquet_event_orders(property_id, event_date) WHERE is_deleted = FALSE AND setup_completed = FALSE;
CREATE INDEX idx_beo_teardown_pending ON banquet_event_orders(property_id, event_date) WHERE is_deleted = FALSE AND teardown_completed = FALSE;

-- Financial indexes
CREATE INDEX idx_beo_guaranteed_count ON banquet_event_orders(property_id, event_date, guaranteed_count) WHERE is_deleted = FALSE;
CREATE INDEX idx_beo_total_estimated ON banquet_event_orders(property_id, event_date, total_estimated) WHERE is_deleted = FALSE;

-- Version tracking
CREATE INDEX idx_beo_version_history ON banquet_event_orders(event_booking_id, beo_version, revision_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_beo_previous_version ON banquet_event_orders(previous_beo_id) WHERE is_deleted = FALSE;

-- Menu type indexes
CREATE INDEX idx_beo_menu_type ON banquet_event_orders(property_id, menu_type, event_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_beo_bar_type ON banquet_event_orders(property_id, bar_type, event_date) WHERE is_deleted = FALSE;

-- Dietary restrictions
CREATE INDEX idx_beo_dietary ON banquet_event_orders(property_id, event_date) WHERE is_deleted = FALSE AND (
    vegetarian_count > 0 OR vegan_count > 0 OR gluten_free_count > 0 OR dairy_free_count > 0 OR
    nut_free_count > 0 OR kosher_count > 0 OR halal_count > 0
);

-- JSONB indexes (GIN)
CREATE INDEX idx_beo_menu_items_gin ON banquet_event_orders USING GIN (menu_items) WHERE is_deleted = FALSE;
CREATE INDEX idx_beo_equipment_gin ON banquet_event_orders USING GIN (equipment_list) WHERE is_deleted = FALSE;
CREATE INDEX idx_beo_av_equipment_gin ON banquet_event_orders USING GIN (av_equipment) WHERE is_deleted = FALSE;
CREATE INDEX idx_beo_metadata_gin ON banquet_event_orders USING GIN (metadata) WHERE is_deleted = FALSE;

-- Audit indexes
CREATE INDEX idx_beo_created ON banquet_event_orders(created_at);
CREATE INDEX idx_beo_updated ON banquet_event_orders(updated_at);
CREATE INDEX idx_beo_revision_date ON banquet_event_orders(revision_date);

\echo 'Indexes for banquet_event_orders created successfully!'
