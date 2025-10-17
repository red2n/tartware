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

-- Indexes
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

COMMENT ON TABLE contract_agreements IS 'Manages legal contracts and agreements with lifecycle tracking';
