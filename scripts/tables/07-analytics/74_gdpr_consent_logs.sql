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
-- Compliance Mapping: docs/compliance-mapping.md#gdpr--privacy

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

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE gdpr_consent_logs IS 'Tracks GDPR and privacy consent management with complete audit trail (see docs/compliance-mapping.md#gdpr--privacy)';
COMMENT ON COLUMN gdpr_consent_logs.consent_id IS 'Unique consent record identifier (UUID)';
COMMENT ON COLUMN gdpr_consent_logs.tenant_id IS 'Reference to tenant (multi-tenancy)';
COMMENT ON COLUMN gdpr_consent_logs.property_id IS 'Reference to property (NULL for tenant-wide consents)';
COMMENT ON COLUMN gdpr_consent_logs.subject_type IS 'Type of data subject (guest, employee, visitor, contact)';
COMMENT ON COLUMN gdpr_consent_logs.subject_id IS 'Reference to the data subject';
COMMENT ON COLUMN gdpr_consent_logs.consent_type IS 'Type of consent (marketing_email, data_processing, cookies, etc.)';
COMMENT ON COLUMN gdpr_consent_logs.consent_status IS 'Current consent status (given, withdrawn, expired, pending)';
COMMENT ON COLUMN gdpr_consent_logs.consent_date IS 'Timestamp when consent was given';
COMMENT ON COLUMN gdpr_consent_logs.withdrawal_date IS 'Timestamp when consent was withdrawn';
COMMENT ON COLUMN gdpr_consent_logs.consent_method IS 'How consent was obtained (web_form, email, verbal, written, etc.)';
COMMENT ON COLUMN gdpr_consent_logs.ip_address IS 'IP address from which consent was given';
COMMENT ON COLUMN gdpr_consent_logs.user_agent IS 'Browser user agent string';
COMMENT ON COLUMN gdpr_consent_logs.legal_basis IS 'Legal basis for processing (consent, contract, legal_obligation, etc.)';
COMMENT ON COLUMN gdpr_consent_logs.purpose_description IS 'Description of data processing purpose';
COMMENT ON COLUMN gdpr_consent_logs.withdrawal_reason IS 'Reason for consent withdrawal';

\echo 'GDPR Consent Logs table created successfully!'
