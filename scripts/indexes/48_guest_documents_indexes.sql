-- =====================================================
-- 48_guest_documents_indexes.sql
-- Guest Documents Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating guest_documents indexes...'

CREATE INDEX idx_guest_documents_tenant ON guest_documents(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_documents_property ON guest_documents(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_documents_guest ON guest_documents(guest_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_documents_reservation ON guest_documents(reservation_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_documents_type ON guest_documents(document_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_documents_category ON guest_documents(document_category) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_documents_number ON guest_documents(document_number) WHERE document_number IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_guest_documents_expiry ON guest_documents(expiry_date) WHERE expiry_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_guest_documents_expiring_soon ON guest_documents(expiry_date) WHERE expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + INTERVAL '90 days' AND is_deleted = FALSE;
CREATE INDEX idx_guest_documents_verified ON guest_documents(is_verified, verification_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_documents_pending_verification ON guest_documents(verification_status) WHERE verification_status = 'pending' AND is_deleted = FALSE;
CREATE INDEX idx_guest_documents_uploaded_at ON guest_documents(uploaded_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_documents_access_level ON guest_documents(access_level) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_documents_retention ON guest_documents(auto_delete_after) WHERE auto_delete_after IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_guest_documents_legal_hold ON guest_documents(legal_hold) WHERE legal_hold = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_guest_documents_pii ON guest_documents(contains_pii) WHERE contains_pii = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_guest_documents_latest_version ON guest_documents(is_latest_version) WHERE is_latest_version = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_guest_documents_metadata ON guest_documents USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_documents_tags ON guest_documents USING gin(tags) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_guest_documents_guest_type ON guest_documents(guest_id, document_type, uploaded_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_documents_property_expiry ON guest_documents(property_id, expiry_date) WHERE expiry_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_guest_documents_verification_pending ON guest_documents(property_id, verification_status, uploaded_at) WHERE verification_status = 'pending' AND is_deleted = FALSE;

\echo 'Guest Documents indexes created successfully!'
