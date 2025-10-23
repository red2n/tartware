-- =====================================================
-- 66_cashier_sessions_indexes.sql
-- Cashier Sessions Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating cashier_sessions indexes...'

CREATE INDEX idx_cashier_sessions_tenant ON cashier_sessions(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_property ON cashier_sessions(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_number ON cashier_sessions(session_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_cashier ON cashier_sessions(cashier_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_terminal ON cashier_sessions(terminal_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_status ON cashier_sessions(session_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_business_date ON cashier_sessions(business_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_opened_at ON cashier_sessions(opened_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_closed_at ON cashier_sessions(closed_at) WHERE closed_at IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_open ON cashier_sessions(session_status) WHERE session_status = 'open' AND is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_variance ON cashier_sessions(has_material_variance) WHERE has_material_variance = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_reconciled ON cashier_sessions(reconciled) WHERE is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_bank_deposit ON cashier_sessions(bank_deposited, bank_deposit_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_approval ON cashier_sessions(requires_approval, approved) WHERE requires_approval = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_discrepancy ON cashier_sessions(has_discrepancy, discrepancy_investigated) WHERE has_discrepancy = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_previous ON cashier_sessions(previous_session_id) WHERE previous_session_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_metadata ON cashier_sessions USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_tags ON cashier_sessions USING gin(tags) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_cashier_sessions_property_date ON cashier_sessions(property_id, business_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_cashier_date ON cashier_sessions(cashier_id, business_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_property_open ON cashier_sessions(property_id, session_status) WHERE session_status = 'open' AND is_deleted = FALSE;
CREATE INDEX idx_cashier_sessions_unreconciled ON cashier_sessions(property_id, session_status, reconciled) WHERE session_status = 'closed' AND reconciled = FALSE AND is_deleted = FALSE;

\echo 'Cashier Sessions indexes created successfully!'
