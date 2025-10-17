-- =====================================================
-- 64_financial_closures_indexes.sql
-- Financial Closures Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating financial_closures indexes...'

CREATE INDEX idx_financial_closures_tenant ON financial_closures(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_property ON financial_closures(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_number ON financial_closures(closure_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_type ON financial_closures(closure_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_status ON financial_closures(closure_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_business_date ON financial_closures(business_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_period ON financial_closures(period_start_date, period_end_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_fiscal_year ON financial_closures(fiscal_year, fiscal_month) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_closed ON financial_closures(is_closed) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_reconciled ON financial_closures(is_reconciled) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_variances ON financial_closures(has_material_variances) WHERE has_material_variances = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_financial_closures_exceptions ON financial_closures(has_exceptions) WHERE has_exceptions = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_financial_closures_approval ON financial_closures(requires_approval, approved) WHERE requires_approval = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_financial_closures_gl_posted ON financial_closures(gl_posted) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_locked ON financial_closures(period_locked, locked_at) WHERE period_locked = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_financial_closures_approved_by ON financial_closures(approved_by, approved_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_previous ON financial_closures(previous_closure_id) WHERE previous_closure_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_financial_closures_metadata ON financial_closures USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_tags ON financial_closures USING gin(tags) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_financial_closures_property_date ON financial_closures(property_id, business_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_property_type_status ON financial_closures(property_id, closure_type, closure_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_property_fiscal ON financial_closures(property_id, fiscal_year, fiscal_month) WHERE is_deleted = FALSE;
CREATE INDEX idx_financial_closures_pending_approval ON financial_closures(property_id, requires_approval, approved) WHERE requires_approval = TRUE AND approved = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_financial_closures_open ON financial_closures(property_id, closure_status) WHERE closure_status IN ('in_progress', 'pending_review') AND is_deleted = FALSE;

\echo 'Financial Closures indexes created successfully!'
