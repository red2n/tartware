-- =====================================================
-- Contract Agreements Table
-- =====================================================
-- Purpose: Manage legal contracts and agreements
-- Key Features:
--   - Contract lifecycle management
--   - Renewal tracking
--   - Obligation management
--   - Compliance monitoring
-- =====================================================

CREATE TABLE IF NOT EXISTS contract_agreements (
    -- Primary Key
    agreement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Agreement Identification
    agreement_number VARCHAR(100) UNIQUE NOT NULL,
    agreement_title VARCHAR(255) NOT NULL,
    agreement_description TEXT,

    -- Agreement Type
    agreement_type VARCHAR(100) CHECK (agreement_type IN (
        'vendor', 'service', 'lease', 'employment', 'nda',
        'partnership', 'license', 'franchise', 'management',
        'guest', 'group', 'corporate', 'legal_settlement', 'other'
    )),

    agreement_category VARCHAR(100),

    -- Parties
    party_a_type VARCHAR(50) CHECK (party_a_type IN ('hotel', 'property', 'company', 'individual')),
    party_a_name VARCHAR(255) NOT NULL,
    party_a_representative VARCHAR(255),
    party_a_contact VARCHAR(255),

    party_b_type VARCHAR(50) CHECK (party_b_type IN ('vendor', 'guest', 'employee', 'partner', 'company', 'individual')),
    party_b_name VARCHAR(255) NOT NULL,
    party_b_representative VARCHAR(255),
    party_b_contact VARCHAR(255),

    additional_parties JSONB, -- [{name, type, role, representative}]

    -- Status
    agreement_status VARCHAR(50) DEFAULT 'draft' CHECK (agreement_status IN (
        'draft', 'pending_review', 'pending_signature', 'active',
        'suspended', 'expired', 'terminated', 'renewed', 'breached'
    )),

    is_active BOOLEAN DEFAULT FALSE,

    -- Dates
    effective_date DATE NOT NULL,
    expiry_date DATE,
    term_length_months INTEGER,

    signed_date DATE,
    execution_date DATE,

    -- Financial Terms
    has_financial_terms BOOLEAN DEFAULT FALSE,
    contract_value DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',

    payment_terms TEXT,
    payment_schedule VARCHAR(100),

    -- Obligations
    party_a_obligations TEXT,
    party_b_obligations TEXT,

    key_obligations JSONB, -- [{party, obligation, deadline, status}]

    -- Performance Metrics
    has_performance_metrics BOOLEAN DEFAULT FALSE,
    performance_metrics JSONB,
    performance_reviews_required BOOLEAN DEFAULT FALSE,
    review_frequency VARCHAR(100),

    -- Renewal Terms
    auto_renewal BOOLEAN DEFAULT FALSE,
    renewal_notice_days INTEGER,
    renewal_date DATE,

    renewal_terms TEXT,
    renegotiation_required BOOLEAN DEFAULT FALSE,

    -- Termination
    termination_clause TEXT,
    termination_notice_days INTEGER,
    early_termination_allowed BOOLEAN DEFAULT FALSE,
    early_termination_penalty DECIMAL(12,2),

    terminated BOOLEAN DEFAULT FALSE,
    termination_date DATE,
    termination_reason TEXT,
    terminated_by UUID,

    -- Confidentiality
    has_nda BOOLEAN DEFAULT FALSE,
    nda_terms TEXT,
    confidentiality_period_years INTEGER,

    -- Liability
    liability_cap DECIMAL(15,2),
    indemnification_clause TEXT,
    insurance_requirements TEXT,

    insurance_required BOOLEAN DEFAULT FALSE,
    insurance_amount DECIMAL(12,2),
    insurance_verified BOOLEAN DEFAULT FALSE,

    -- Dispute Resolution
    dispute_resolution_method VARCHAR(100) CHECK (dispute_resolution_method IN (
        'negotiation', 'mediation', 'arbitration', 'litigation', 'hybrid'
    )),

    governing_law VARCHAR(255),
    jurisdiction VARCHAR(255),
    arbitration_location VARCHAR(255),

    -- Breach
    breach_reported BOOLEAN DEFAULT FALSE,
    breach_date DATE,
    breach_description TEXT,
    breach_remedy TEXT,

    -- Amendments
    amendment_count INTEGER DEFAULT 0,
    amendments JSONB, -- [{date, description, amended_by}]

    -- Legal Review
    legal_review_required BOOLEAN DEFAULT TRUE,
    legal_reviewed BOOLEAN DEFAULT FALSE,
    legal_reviewed_by UUID,
    legal_review_date DATE,
    legal_review_notes TEXT,

    -- Approval Workflow
    requires_approval BOOLEAN DEFAULT TRUE,
    approval_level VARCHAR(50),

    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,

    -- Signatures
    requires_signature BOOLEAN DEFAULT TRUE,
    party_a_signed BOOLEAN DEFAULT FALSE,
    party_a_signed_by VARCHAR(255),
    party_a_signed_date DATE,

    party_b_signed BOOLEAN DEFAULT FALSE,
    party_b_signed_by VARCHAR(255),
    party_b_signed_date DATE,

    fully_executed BOOLEAN DEFAULT FALSE,
    execution_complete_date DATE,

    -- Documents
    draft_document_url TEXT,
    final_document_url TEXT,
    signed_document_url TEXT,

    has_attachments BOOLEAN DEFAULT FALSE,
    attachment_urls TEXT[],

    -- Compliance
    compliance_requirements TEXT,
    regulatory_filing_required BOOLEAN DEFAULT FALSE,
    regulatory_filed BOOLEAN DEFAULT FALSE,
    filing_reference VARCHAR(100),

    -- Monitoring
    milestone_tracking BOOLEAN DEFAULT FALSE,
    milestones JSONB, -- [{description, deadline, status, completed_date}]

    obligations_met BOOLEAN,
    compliance_status VARCHAR(50),

    -- Notifications
    alert_before_expiry_days INTEGER DEFAULT 90,
    expiry_alert_sent BOOLEAN DEFAULT FALSE,

    renewal_reminder_sent BOOLEAN DEFAULT FALSE,
    renewal_reminder_date DATE,

    -- Related Contracts
    parent_agreement_id UUID,
    supersedes_agreement_id UUID,
    superseded_by_agreement_id UUID,
    related_agreements UUID[],

    -- Metadata
    metadata JSONB,
    notes TEXT,
    internal_notes TEXT,
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

COMMENT ON TABLE contract_agreements IS 'Manages legal contracts and agreements with lifecycle tracking, renewal management, and compliance monitoring';
COMMENT ON COLUMN contract_agreements.agreement_id IS 'Unique agreement identifier (UUID)';
COMMENT ON COLUMN contract_agreements.tenant_id IS 'Reference to tenant (multi-tenancy)';
COMMENT ON COLUMN contract_agreements.property_id IS 'Reference to property (NULL for tenant-wide agreements)';
COMMENT ON COLUMN contract_agreements.agreement_number IS 'Unique agreement reference number';
COMMENT ON COLUMN contract_agreements.agreement_title IS 'Title of the agreement';
COMMENT ON COLUMN contract_agreements.agreement_type IS 'Type of agreement (vendor, service, lease, employment, nda, etc.)';
COMMENT ON COLUMN contract_agreements.agreement_status IS 'Current status (draft, pending_review, active, expired, terminated, etc.)';
COMMENT ON COLUMN contract_agreements.effective_date IS 'Contract effective date';
COMMENT ON COLUMN contract_agreements.expiry_date IS 'Contract expiry date';
COMMENT ON COLUMN contract_agreements.contract_value IS 'Total contract value';
COMMENT ON COLUMN contract_agreements.payment_terms IS 'Payment terms and conditions';
COMMENT ON COLUMN contract_agreements.auto_renewal IS 'Whether contract auto-renews';
COMMENT ON COLUMN contract_agreements.renewal_notice_days IS 'Days before expiry to send renewal notice';
COMMENT ON COLUMN contract_agreements.party_a_name IS 'Name of party A in agreement';
COMMENT ON COLUMN contract_agreements.party_b_name IS 'Name of party B in agreement';
COMMENT ON COLUMN contract_agreements.party_a_signed IS 'Whether agreement has been signed by party A';
COMMENT ON COLUMN contract_agreements.party_b_signed IS 'Whether agreement has been signed by party B';

\echo 'Contract Agreements table created successfully!'
