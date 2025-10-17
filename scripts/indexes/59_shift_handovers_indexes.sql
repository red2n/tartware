-- =====================================================
-- 59_shift_handovers_indexes.sql
-- Shift Handovers Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating shift_handovers indexes...'

CREATE INDEX idx_shift_handovers_tenant ON shift_handovers(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_property ON shift_handovers(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_number ON shift_handovers(handover_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_date ON shift_handovers(shift_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_department ON shift_handovers(department) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_outgoing_user ON shift_handovers(outgoing_user_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_incoming_user ON shift_handovers(incoming_user_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_status ON shift_handovers(handover_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_pending ON shift_handovers(handover_status) WHERE handover_status IN ('pending', 'in_progress') AND is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_acknowledged ON shift_handovers(acknowledged) WHERE acknowledged = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_follow_up ON shift_handovers(requires_follow_up) WHERE requires_follow_up = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_escalated ON shift_handovers(escalation_count) WHERE escalation_count > 0 AND is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_manager_review ON shift_handovers(reviewed_by_manager) WHERE reviewed_by_manager = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_tasks_details ON shift_handovers USING gin(tasks_details) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_guest_issues ON shift_handovers USING gin(guest_issues) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_maintenance_issues ON shift_handovers USING gin(maintenance_issues) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_metadata ON shift_handovers USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_tags ON shift_handovers USING gin(tags) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_shift_handovers_property_date ON shift_handovers(property_id, shift_date DESC, department) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_property_department ON shift_handovers(property_id, department, shift_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_date_shift ON shift_handovers(shift_date, outgoing_shift, incoming_shift) WHERE is_deleted = FALSE;
CREATE INDEX idx_shift_handovers_recent ON shift_handovers(property_id, shift_date DESC, handover_completed_at DESC) WHERE is_deleted = FALSE;

\echo 'Shift Handovers indexes created successfully!'
