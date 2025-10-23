-- =====================================================
-- 74_gdpr_consent_logs_indexes.sql
-- Gdpr Consent Logs Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating gdpr_consent_logs indexes...'

CREATE INDEX idx_gdpr_consent_logs_tenant ON gdpr_consent_logs(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_property ON gdpr_consent_logs(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_subject ON gdpr_consent_logs(subject_type, subject_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_email ON gdpr_consent_logs(subject_email) WHERE is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_type ON gdpr_consent_logs(consent_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_status ON gdpr_consent_logs(consent_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_active ON gdpr_consent_logs(is_active, consent_given) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_consent_date ON gdpr_consent_logs(consent_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_expiry ON gdpr_consent_logs(expiry_date) WHERE expiry_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_withdrawal ON gdpr_consent_logs(withdrawal_date) WHERE withdrawal_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_renewal ON gdpr_consent_logs(renewal_required, expiry_date) WHERE renewal_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_rights ON gdpr_consent_logs(right_to_erasure_exercised) WHERE right_to_erasure_exercised = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_dpo_review ON gdpr_consent_logs(dpo_reviewed) WHERE dpo_reviewed = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_metadata ON gdpr_consent_logs USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_tags ON gdpr_consent_logs USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_subject_active ON gdpr_consent_logs(subject_id, consent_type, is_active) WHERE is_deleted = FALSE;
CREATE INDEX idx_gdpr_consent_logs_property_type ON gdpr_consent_logs(property_id, consent_type, consent_status) WHERE is_deleted = FALSE;

\echo 'Gdpr Consent Logs indexes created successfully!'
