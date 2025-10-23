-- =====================================================
-- 60_lost_and_found_indexes.sql
-- Lost And Found Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating lost_and_found indexes...'

CREATE INDEX idx_lost_and_found_tenant ON lost_and_found(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_property ON lost_and_found(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_item_number ON lost_and_found(item_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_category ON lost_and_found(item_category) WHERE is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_status ON lost_and_found(item_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_found_date ON lost_and_found(found_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_found_by ON lost_and_found(found_by) WHERE is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_guest ON lost_and_found(guest_id) WHERE guest_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_reservation ON lost_and_found(reservation_id) WHERE reservation_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_room ON lost_and_found(room_id) WHERE room_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_claimed ON lost_and_found(claimed) WHERE is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_unclaimed ON lost_and_found(claimed) WHERE claimed = FALSE AND item_status IN ('registered', 'stored') AND is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_valuable ON lost_and_found(is_valuable) WHERE is_valuable = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_disposal_due ON lost_and_found(disposal_date) WHERE disposal_date IS NOT NULL AND disposed = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_guest_notified ON lost_and_found(guest_notified) WHERE guest_id IS NOT NULL AND guest_notified = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_pending_claims ON lost_and_found(item_status) WHERE item_status = 'pending_claim' AND is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_shipped ON lost_and_found(shipped, delivery_confirmed) WHERE shipped = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_storage_location ON lost_and_found(storage_location) WHERE item_status IN ('stored', 'registered') AND is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_metadata ON lost_and_found USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_tags ON lost_and_found USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_property_status ON lost_and_found(property_id, item_status, found_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_property_unclaimed ON lost_and_found(property_id, found_date DESC) WHERE claimed = FALSE AND item_status IN ('registered', 'stored') AND is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_guest_items ON lost_and_found(guest_id, found_date DESC) WHERE guest_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_lost_and_found_recent ON lost_and_found(property_id, found_date DESC, item_status) WHERE is_deleted = FALSE;

\echo 'Lost And Found indexes created successfully!'
