-- =====================================================
-- 76_contract_agreements_indexes.sql
-- Contract Agreements Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating contract_agreements indexes...'

CREATE INDEX idx_contract_agreements_tenant ON contract_agreements(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_property ON contract_agreements(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_number ON contract_agreements(agreement_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_type ON contract_agreements(agreement_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_status ON contract_agreements(agreement_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_active ON contract_agreements(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_effective ON contract_agreements(effective_date, expiry_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_expiring ON contract_agreements(expiry_date) WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days' AND is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_renewal ON contract_agreements(auto_renewal, renewal_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_terminated ON contract_agreements(terminated, termination_date) WHERE terminated = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_breach ON contract_agreements(breach_reported) WHERE breach_reported = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_legal_review ON contract_agreements(legal_review_required, legal_reviewed) WHERE legal_review_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_approval ON contract_agreements(requires_approval, approved) WHERE requires_approval = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_signature ON contract_agreements(requires_signature, fully_executed) WHERE requires_signature = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_insurance ON contract_agreements(insurance_required, insurance_verified) WHERE insurance_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_parent ON contract_agreements(parent_agreement_id) WHERE parent_agreement_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_metadata ON contract_agreements USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_tags ON contract_agreements USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_property_active ON contract_agreements(property_id, is_active, expiry_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_property_type ON contract_agreements(property_id, agreement_type, agreement_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_contract_agreements_pending_signature ON contract_agreements(property_id, requires_signature, fully_executed) WHERE requires_signature = TRUE AND fully_executed = FALSE AND is_deleted = FALSE;

\echo 'Contract Agreements indexes created successfully!'
