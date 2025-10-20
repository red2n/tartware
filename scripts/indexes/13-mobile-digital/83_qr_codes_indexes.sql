-- =====================================================
-- 83_qr_codes_indexes.sql
-- Qr Codes Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating qr_codes indexes...'

CREATE INDEX idx_qr_codes_tenant ON qr_codes(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_qr_codes_property ON qr_codes(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_qr_codes_code ON qr_codes(code_value) WHERE is_deleted = FALSE;
CREATE INDEX idx_qr_codes_type ON qr_codes(code_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_qr_codes_active ON qr_codes(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_qr_codes_room ON qr_codes(room_id) WHERE room_id IS NOT NULL AND is_deleted = FALSE;

\echo 'Qr Codes indexes created successfully!'
