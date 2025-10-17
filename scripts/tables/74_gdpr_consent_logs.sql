-- =====================================================
-- GDPR Consent Logs Table
-- =====================================================
-- Purpose: Track GDPR and privacy consent management
-- Key Features:
--   - Consent tracking
--   - Audit trail
--   - Right to be forgotten
--   - Data processing records
-- =====================================================

CREATE TABLE IF NOT EXISTS gdpr_consent_logs (
    -- Primary Key
    consent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Subject
    subject_type VARCHAR(50) CHECK (subject_type IN ('guest', 'employee', 'visitor', 'contact', 'other')),
    subject_id UUID NOT NULL,
    subject_email VARCHAR(255),
    subject_name VARCHAR(255),

    -- Consent Type
    consent_type VARCHAR(100) NOT NULL CHECK (consent_type IN (
        'marketing_email', 'marketing_sms', 'marketing_phone', 'marketing_postal',
        'data_processing', 'data_sharing', 'profiling', 'analytics',
        'cookies_essential', 'cookies_analytics', 'cookies_marketing',
        'third_party_sharing', 'automated_decisions', 'other'
    )),

    consent_category VARCHAR(100),

    -- Consent Status
    consent_given BOOLEAN NOT NULL,
    consent_status VARCHAR(50) CHECK (consent_status IN (
        'given', 'withdrawn', 'expired', 'renewed', 'pending'
    )),

    -- Dates
    consent_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expiry_date TIMESTAMP WITH TIME ZONE,
    withdrawal_date TIMESTAMP WITH TIME ZONE,

    is_active BOOLEAN DEFAULT TRUE,

    -- Method of Consent
    consent_method VARCHAR(100) CHECK (consent_method IN (
        'online_form', 'email_link', 'checkbox', 'verbal', 'written',
        'opt_in', 'opt_out', 'implied', 'explicit', 'other'
    )),

    -- Source
    consent_source VARCHAR(255),
    consent_source_url TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Purpose
    purpose_description TEXT NOT NULL,
    legal_basis VARCHAR(100) CHECK (legal_basis IN (
        'consent', 'contract', 'legal_obligation', 'vital_interests',
        'public_task', 'legitimate_interests'
    )),

    -- Data Categories
    data_categories VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR[],
    processing_purposes VARCHAR(100)[] DEFAULT ARRAY[]::VARCHAR[],

    -- Third Party Sharing
    shared_with_third_parties BOOLEAN DEFAULT FALSE,
    third_party_names VARCHAR(255)[],
    third_party_purposes TEXT,

    -- Geographic
    data_transfer_outside_eu BOOLEAN DEFAULT FALSE,
    transfer_countries VARCHAR(3)[],
    safeguards_applied TEXT,

    -- Retention
    retention_period VARCHAR(100),
    retention_end_date DATE,

    -- Rights Exercised
    right_to_access_exercised BOOLEAN DEFAULT FALSE,
    right_to_rectification_exercised BOOLEAN DEFAULT FALSE,
    right_to_erasure_exercised BOOLEAN DEFAULT FALSE,
    right_to_restrict_exercised BOOLEAN DEFAULT FALSE,
    right_to_portability_exercised BOOLEAN DEFAULT FALSE,
    right_to_object_exercised BOOLEAN DEFAULT FALSE,

    -- Version Control
    consent_version VARCHAR(50),
    policy_version VARCHAR(50),
    terms_version VARCHAR(50),

    previous_consent_id UUID,
    superseded_by_consent_id UUID,

    -- Withdrawal Details
    withdrawn_by VARCHAR(50) CHECK (withdrawn_by IN ('subject', 'system', 'admin', 'regulator')),
    withdrawal_method VARCHAR(100),
    withdrawal_reason TEXT,

    -- Renewal
    renewal_required BOOLEAN DEFAULT FALSE,
    renewal_reminder_sent BOOLEAN DEFAULT FALSE,
    renewal_reminder_date DATE,

    -- Audit Trail
    consent_proof_url TEXT,
    consent_document_url TEXT,

    recorded_by UUID,
    verified_by UUID,
    verified_at TIMESTAMP WITH TIME ZONE,

    -- Compliance
    gdpr_compliant BOOLEAN DEFAULT TRUE,
    ccpa_compliant BOOLEAN DEFAULT FALSE,
    compliance_notes TEXT,

    -- DPO Review
    dpo_reviewed BOOLEAN DEFAULT FALSE,
    dpo_reviewed_by UUID,
    dpo_review_date DATE,
    dpo_notes TEXT,

    -- Metadata
    metadata JSONB,
    notes TEXT,
    tags VARCHAR(100)[],

    -- Standard Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- Indexes
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

COMMENT ON TABLE gdpr_consent_logs IS 'Tracks GDPR and privacy consent with full audit trail';
