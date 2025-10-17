-- =====================================================
-- 62_vendor_contracts_indexes.sql
-- Vendor Contracts Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating vendor_contracts indexes...'

CREATE INDEX idx_vendor_contracts_tenant ON vendor_contracts(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_property ON vendor_contracts(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_number ON vendor_contracts(contract_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_vendor_name ON vendor_contracts(vendor_name) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_vendor_type ON vendor_contracts(vendor_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_type ON vendor_contracts(contract_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_status ON vendor_contracts(contract_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_active ON vendor_contracts(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_start_date ON vendor_contracts(start_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_end_date ON vendor_contracts(end_date) WHERE end_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_expiring_soon ON vendor_contracts(end_date) WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days' AND is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_renewal_date ON vendor_contracts(renewal_date) WHERE renewal_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_auto_renewal ON vendor_contracts(auto_renewal, renewal_date) WHERE auto_renewal = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_insurance_expiry ON vendor_contracts(insurance_required, insurance_expiry_date) WHERE insurance_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_payment_due ON vendor_contracts(next_payment_due_date) WHERE next_payment_due_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_owner ON vendor_contracts(contract_owner) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_approved ON vendor_contracts(requires_approval, approved) WHERE requires_approval = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_legal_review ON vendor_contracts(legal_review_required, legal_reviewed) WHERE legal_review_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_performance_issues ON vendor_contracts(has_performance_issues) WHERE has_performance_issues = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_risk ON vendor_contracts(risk_level) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_parent ON vendor_contracts(parent_contract_id) WHERE parent_contract_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_metadata ON vendor_contracts USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_tags ON vendor_contracts USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_property_status ON vendor_contracts(property_id, contract_status, end_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_property_active ON vendor_contracts(property_id, is_active, end_date) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_vendor_active ON vendor_contracts(vendor_name, is_active, start_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_expiring ON vendor_contracts(property_id, end_date) WHERE contract_status = 'active' AND end_date IS NOT NULL AND is_deleted = FALSE;

\echo 'Vendor Contracts indexes created successfully!'
