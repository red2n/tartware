-- =====================================================
-- 49_guest_notes_indexes.sql
-- Guest Notes Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating guest_notes indexes...'

CREATE INDEX idx_guest_notes_tenant ON guest_notes(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_notes_property ON guest_notes(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_notes_guest ON guest_notes(guest_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_notes_reservation ON guest_notes(reservation_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_notes_type ON guest_notes(note_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_notes_category ON guest_notes(note_category) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_notes_priority ON guest_notes(priority) WHERE priority IN ('high', 'urgent', 'critical') AND is_deleted = FALSE;
CREATE INDEX idx_guest_notes_severity ON guest_notes(severity) WHERE severity IN ('high', 'critical') AND is_deleted = FALSE;
CREATE INDEX idx_guest_notes_alert ON guest_notes(is_alert, alert_level) WHERE is_alert = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_guest_notes_status ON guest_notes(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_notes_unresolved ON guest_notes(is_resolved) WHERE is_resolved = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_guest_notes_action_required ON guest_notes(requires_action, action_deadline) WHERE requires_action = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_guest_notes_assigned_to ON guest_notes(assigned_to) WHERE assigned_to IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_guest_notes_followup ON guest_notes(requires_followup, followup_date) WHERE requires_followup = TRUE AND followup_completed = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_guest_notes_created_at ON guest_notes(created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_notes_created_by ON guest_notes(created_by) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_notes_parent ON guest_notes(parent_note_id) WHERE parent_note_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_guest_notes_metadata ON guest_notes USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_notes_tags ON guest_notes USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_notes_alert_triggers ON guest_notes USING gin(alert_trigger) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_guest_notes_guest_type ON guest_notes(guest_id, note_type, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_notes_property_status ON guest_notes(property_id, status, priority) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_notes_property_unresolved ON guest_notes(property_id, is_resolved, created_at DESC) WHERE is_resolved = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_guest_notes_alerts_active ON guest_notes(property_id, is_alert, show_on_checkin) WHERE is_alert = TRUE AND is_deleted = FALSE;

\echo 'Guest Notes indexes created successfully!'
