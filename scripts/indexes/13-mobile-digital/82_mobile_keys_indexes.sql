-- =====================================================
-- 82_mobile_keys_indexes.sql
-- Mobile Keys Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating mobile_keys indexes...'

CREATE INDEX idx_mobile_keys_tenant ON mobile_keys(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_mobile_keys_property ON mobile_keys(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_mobile_keys_guest ON mobile_keys(guest_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_mobile_keys_reservation ON mobile_keys(reservation_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_mobile_keys_room ON mobile_keys(room_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_mobile_keys_code ON mobile_keys(key_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_mobile_keys_status ON mobile_keys(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_mobile_keys_valid ON mobile_keys(valid_from, valid_to) WHERE status = 'active' AND is_deleted = FALSE;

\echo 'Mobile Keys indexes created successfully!'
