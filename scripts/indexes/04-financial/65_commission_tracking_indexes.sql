-- =====================================================
-- 65_commission_tracking_indexes.sql
-- Commission Tracking Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating commission_tracking indexes...'

CREATE INDEX idx_commission_tracking_tenant ON commission_tracking(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_property ON commission_tracking(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_number ON commission_tracking(commission_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_type ON commission_tracking(commission_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_beneficiary ON commission_tracking(beneficiary_type, beneficiary_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_staff ON commission_tracking(staff_id) WHERE staff_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_agent ON commission_tracking(agent_id) WHERE agent_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_source ON commission_tracking(source_type, source_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_reservation ON commission_tracking(reservation_id) WHERE reservation_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_status ON commission_tracking(commission_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_payment_status ON commission_tracking(payment_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_payment_due ON commission_tracking(payment_due_date) WHERE payment_status IN ('unpaid', 'scheduled') AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_transaction_date ON commission_tracking(transaction_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_approval ON commission_tracking(requires_approval, approved) WHERE requires_approval = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_split ON commission_tracking(is_split, primary_commission_id) WHERE is_split = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_disputed ON commission_tracking(disputed, dispute_resolved) WHERE disputed = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_reversed ON commission_tracking(reversed) WHERE reversed = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_reconciled ON commission_tracking(reconciled) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_fiscal ON commission_tracking(fiscal_year, fiscal_month) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_gl_posted ON commission_tracking(gl_posted) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_parent ON commission_tracking(parent_commission_id) WHERE parent_commission_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_metadata ON commission_tracking USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_tags ON commission_tracking USING gin(tags) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_commission_tracking_staff_unpaid ON commission_tracking(staff_id, payment_status, payment_due_date) WHERE staff_id IS NOT NULL AND payment_status IN ('unpaid', 'scheduled') AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_property_pending ON commission_tracking(property_id, commission_status) WHERE commission_status IN ('pending', 'calculated') AND is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_beneficiary_period ON commission_tracking(beneficiary_id, fiscal_year, fiscal_month) WHERE is_deleted = FALSE;
CREATE INDEX idx_commission_tracking_payment_cycle ON commission_tracking(payment_cycle, scheduled_payment_date) WHERE payment_status = 'scheduled' AND is_deleted = FALSE;

\echo 'Commission Tracking indexes created successfully!'
