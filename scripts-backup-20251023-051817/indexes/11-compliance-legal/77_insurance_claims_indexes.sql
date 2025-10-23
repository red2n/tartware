-- =====================================================
-- 77_insurance_claims_indexes.sql
-- Insurance Claims Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating insurance_claims indexes...'

CREATE INDEX idx_insurance_claims_tenant ON insurance_claims(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_property ON insurance_claims(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_number ON insurance_claims(claim_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_insurance_number ON insurance_claims(insurance_claim_number) WHERE insurance_claim_number IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_policy ON insurance_claims(policy_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_type ON insurance_claims(claim_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_status ON insurance_claims(claim_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_incident_date ON insurance_claims(incident_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_filed_date ON insurance_claims(claim_filed_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_incident_report ON insurance_claims(incident_report_id) WHERE incident_report_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_police_report ON insurance_claims(police_report_id) WHERE police_report_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_room ON insurance_claims(room_id) WHERE room_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_guest ON insurance_claims(guest_id) WHERE guest_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_employee ON insurance_claims(employee_id) WHERE employee_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_company ON insurance_claims(insurance_company) WHERE is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_investigation ON insurance_claims(investigation_required) WHERE investigation_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_denied ON insurance_claims(denied) WHERE denied = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_appealed ON insurance_claims(appealed) WHERE appealed = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_settlement ON insurance_claims(settlement_offered, settlement_accepted) WHERE is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_payment ON insurance_claims(payment_received, outstanding_amount) WHERE outstanding_amount > 0 AND is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_subrogation ON insurance_claims(subrogation_pursued) WHERE subrogation_potential = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_legal ON insurance_claims(legal_action_required) WHERE legal_action_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_follow_up ON insurance_claims(follow_up_required, follow_up_date) WHERE follow_up_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_parent ON insurance_claims(parent_claim_id) WHERE parent_claim_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_metadata ON insurance_claims USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_tags ON insurance_claims USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_property_status ON insurance_claims(property_id, claim_status, claim_filed_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_property_type ON insurance_claims(property_id, claim_type, incident_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_insurance_claims_property_open ON insurance_claims(property_id, claim_status) WHERE claim_status IN ('submitted', 'under_review', 'investigating') AND is_deleted = FALSE;

\echo 'Insurance Claims indexes created successfully!'
