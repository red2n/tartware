-- =====================================================
-- 68_credit_limits_indexes.sql
-- Credit Limits Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating credit_limits indexes...'

CREATE INDEX idx_credit_limits_tenant ON credit_limits(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_credit_limits_property ON credit_limits(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_credit_limits_account ON credit_limits(account_type, account_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_credit_limits_guest ON credit_limits(guest_id) WHERE guest_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_credit_limits_company ON credit_limits(company_id) WHERE company_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_credit_limits_status ON credit_limits(credit_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_credit_limits_active ON credit_limits(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_credit_limits_effective ON credit_limits(effective_from, effective_to) WHERE is_deleted = FALSE;
CREATE INDEX idx_credit_limits_utilization ON credit_limits(credit_utilization_percent DESC) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_credit_limits_warning ON credit_limits(warning_threshold_reached) WHERE warning_threshold_reached = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_credit_limits_block ON credit_limits(block_threshold_reached) WHERE block_threshold_reached = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_credit_limits_temp_increase ON credit_limits(temporary_increase_active, temporary_increase_expires) WHERE temporary_increase_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_credit_limits_risk ON credit_limits(risk_level, risk_score) WHERE is_deleted = FALSE;
CREATE INDEX idx_credit_limits_credit_check_expiry ON credit_limits(credit_check_valid_until) WHERE credit_check_performed = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_credit_limits_review ON credit_limits(requires_review, next_review_date) WHERE requires_review = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_credit_limits_approval ON credit_limits(requires_approval, approved) WHERE requires_approval = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_credit_limits_suspended ON credit_limits(suspended) WHERE suspended = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_credit_limits_blocked ON credit_limits(blocked) WHERE blocked = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_credit_limits_overdue ON credit_limits(overdue_amount) WHERE overdue_amount > 0 AND is_deleted = FALSE;
CREATE INDEX idx_credit_limits_relationship_manager ON credit_limits(relationship_manager_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_credit_limits_metadata ON credit_limits USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_credit_limits_tags ON credit_limits USING gin(tags) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_credit_limits_property_active ON credit_limits(property_id, is_active, credit_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_credit_limits_property_utilization ON credit_limits(property_id, credit_utilization_percent DESC) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_credit_limits_property_risk ON credit_limits(property_id, risk_level, credit_limit_amount DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_credit_limits_account_active ON credit_limits(account_id, is_active) WHERE is_deleted = FALSE;

\echo 'Credit Limits indexes created successfully!'
