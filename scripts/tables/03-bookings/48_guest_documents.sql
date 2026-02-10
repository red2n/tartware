-- =====================================================
-- Guest Documents Table
-- =====================================================
-- Purpose: Store and manage guest identification and related documents
-- Key Features:
--   - Secure document storage
--   - Document verification tracking
--   - Expiry management
--   - Compliance with data retention policies
-- =====================================================

CREATE TABLE IF NOT EXISTS guest_documents (
    -- Primary Key
    document_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Guest & Reservation Reference
    guest_id UUID NOT NULL,
    reservation_id UUID,

    -- Document Classification
    document_type VARCHAR(100) NOT NULL CHECK (document_type IN ('passport', 'national_id', 'drivers_license', 'visa', 'work_permit', 'registration_card', 'invoice', 'receipt', 'agreement', 'contract', 'photo', 'signature', 'credit_card', 'insurance', 'other')),
    document_category VARCHAR(50) CHECK (document_category IN ('identification', 'legal', 'financial', 'medical', 'general')),
    document_number VARCHAR(100),
    document_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- File Information
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT,
    file_type VARCHAR(50),
    mime_type VARCHAR(100),
    file_hash VARCHAR(128), -- SHA-256 hash for integrity

    -- Document Details
    issue_date DATE,
    expiry_date DATE,
    issuing_country VARCHAR(3), -- ISO 3166-1 alpha-3
    issuing_state VARCHAR(100),
    issuing_authority VARCHAR(200),

    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verification_status VARCHAR(50) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired', 'requires_update')),
    verified_by UUID,
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_method VARCHAR(50) CHECK (verification_method IN ('manual', 'automated', 'third_party', 'ocr', 'biometric')),
    verification_notes TEXT,

    -- Upload Information
    uploaded_by UUID,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    upload_source VARCHAR(50) CHECK (upload_source IN ('web', 'mobile', 'email', 'scan', 'fax', 'admin', 'kiosk', 'api')),
    upload_device_info JSONB,

    -- Security
    is_encrypted BOOLEAN DEFAULT FALSE,
    encryption_algorithm VARCHAR(50),
    encryption_key_id VARCHAR(100),
    access_level VARCHAR(50) DEFAULT 'restricted' CHECK (access_level IN ('public', 'internal', 'restricted', 'confidential', 'secret')),
    requires_2fa BOOLEAN DEFAULT FALSE,

    -- Access Control
    viewable_by_roles VARCHAR(100)[],
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMP WITH TIME ZONE,
    last_viewed_by UUID,
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMP WITH TIME ZONE,

    -- Retention & Compliance
    retention_policy VARCHAR(100),
    retention_period_days INTEGER,
    retain_until_date DATE,
    auto_delete_after DATE,
    legal_hold BOOLEAN DEFAULT FALSE,
    legal_hold_reason TEXT,

    -- GDPR Compliance
    contains_pii BOOLEAN DEFAULT TRUE,
    gdpr_category VARCHAR(100),
    processing_purpose TEXT,
    consent_obtained BOOLEAN DEFAULT FALSE,
    consent_date DATE,

    -- Expiry Alerts
    expiry_alert_sent BOOLEAN DEFAULT FALSE,
    expiry_alert_date DATE,
    days_before_expiry_alert INTEGER DEFAULT 30,

    -- Version Control
    version INTEGER DEFAULT 1,
    previous_version_id UUID,
    is_latest_version BOOLEAN DEFAULT TRUE,

    -- Metadata
    metadata JSONB,
    tags VARCHAR(100)[],
    notes TEXT,

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


-- Comments
COMMENT ON TABLE guest_documents IS 'Stores guest identification documents, contracts, and related files with security and compliance features';
COMMENT ON COLUMN guest_documents.file_hash IS 'SHA-256 hash of file content for integrity verification';
COMMENT ON COLUMN guest_documents.retention_period_days IS 'Number of days to retain document as per policy';
COMMENT ON COLUMN guest_documents.legal_hold IS 'Prevents deletion when document is subject to legal proceedings';

\echo 'guest_documents table created successfully!'

\echo 'guest_documents table created successfully!'

\echo 'guest_documents table created successfully!'
