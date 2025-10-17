-- =====================================================
-- Vendor Contracts Table
-- =====================================================
-- Purpose: Manage vendor contracts, agreements, and relationships
-- Key Features:
--   - Contract lifecycle management
--   - Renewal tracking
--   - Performance monitoring
--   - Compliance management
-- =====================================================

CREATE TABLE IF NOT EXISTS vendor_contracts (
    -- Primary Key
    contract_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Contract Identification
    contract_number VARCHAR(100) UNIQUE NOT NULL,
    contract_name VARCHAR(255) NOT NULL,
    contract_title VARCHAR(255),

    -- Vendor Information
    vendor_name VARCHAR(255) NOT NULL,
    vendor_id VARCHAR(100),
    vendor_type VARCHAR(100) CHECK (vendor_type IN (
        'supplier', 'service_provider', 'contractor', 'consultant',
        'maintenance', 'food_beverage', 'technology', 'utilities',
        'marketing', 'linen', 'cleaning', 'security', 'other'
    )),

    -- Vendor Contact
    vendor_contact_name VARCHAR(200),
    vendor_contact_title VARCHAR(100),
    vendor_email VARCHAR(255),
    vendor_phone VARCHAR(50),
    vendor_address TEXT,
    vendor_website VARCHAR(255),

    -- Contract Type
    contract_type VARCHAR(100) NOT NULL CHECK (contract_type IN (
        'service', 'supply', 'maintenance', 'lease', 'license',
        'employment', 'consulting', 'partnership', 'master_agreement',
        'purchase_order', 'subscription', 'other'
    )),
    contract_category VARCHAR(100),

    -- Service/Product Description
    service_description TEXT NOT NULL,
    scope_of_work TEXT,
    deliverables TEXT,

    -- Contract Dates
    start_date DATE NOT NULL,
    end_date DATE,
    contract_duration_months INTEGER,

    effective_date DATE,
    execution_date DATE,
    signed_date DATE,

    -- Status
    contract_status VARCHAR(50) DEFAULT 'draft' CHECK (contract_status IN (
        'draft', 'pending_approval', 'approved', 'active',
        'suspended', 'expired', 'terminated', 'renewed', 'cancelled'
    )),
    is_active BOOLEAN DEFAULT FALSE,

    -- Financial Terms
    contract_value DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    payment_terms VARCHAR(100) CHECK (payment_terms IN (
        'net_15', 'net_30', 'net_45', 'net_60', 'net_90',
        'due_on_receipt', 'advance', 'monthly', 'quarterly', 'annual', 'milestone', 'custom'
    )),
    payment_schedule VARCHAR(100),
    billing_frequency VARCHAR(50) CHECK (billing_frequency IN ('monthly', 'quarterly', 'annual', 'per_service', 'milestone', 'other')),

    -- Pricing
    pricing_model VARCHAR(100) CHECK (pricing_model IN (
        'fixed_price', 'hourly', 'daily', 'monthly', 'unit_based',
        'volume_discount', 'tiered', 'cost_plus', 'retainer', 'other'
    )),
    unit_price DECIMAL(10,2),
    hourly_rate DECIMAL(10,2),
    minimum_charge DECIMAL(10,2),
    maximum_charge DECIMAL(10,2),

    -- Payment Tracking
    total_paid DECIMAL(12,2) DEFAULT 0.00,
    total_invoiced DECIMAL(12,2) DEFAULT 0.00,
    outstanding_balance DECIMAL(12,2) DEFAULT 0.00,
    last_payment_date DATE,
    next_payment_due_date DATE,

    -- Performance Metrics
    performance_rating INTEGER CHECK (performance_rating BETWEEN 1 AND 5),
    quality_score INTEGER CHECK (quality_score BETWEEN 0 AND 100),
    on_time_delivery_percent DECIMAL(5,2),
    customer_satisfaction_score DECIMAL(5,2),
    sla_compliance_percent DECIMAL(5,2),

    -- SLA Terms
    has_sla BOOLEAN DEFAULT FALSE,
    sla_terms TEXT,
    response_time_hours INTEGER,
    resolution_time_hours INTEGER,
    uptime_guarantee_percent DECIMAL(5,2),
    sla_penalties TEXT,

    -- Renewal Terms
    auto_renewal BOOLEAN DEFAULT FALSE,
    renewal_notice_days INTEGER DEFAULT 30,
    renewal_date DATE,
    renewal_reminder_sent BOOLEAN DEFAULT FALSE,
    renewal_reminder_date DATE,

    -- Termination
    termination_notice_days INTEGER,
    early_termination_allowed BOOLEAN DEFAULT FALSE,
    early_termination_penalty DECIMAL(10,2),
    termination_for_convenience BOOLEAN DEFAULT FALSE,
    termination_reason TEXT,
    terminated_by UUID,
    terminated_at TIMESTAMP WITH TIME ZONE,

    -- Insurance Requirements
    insurance_required BOOLEAN DEFAULT FALSE,
    insurance_types VARCHAR(100)[], -- ['liability', 'workers_comp', 'professional']
    insurance_coverage_amount DECIMAL(12,2),
    insurance_expiry_date DATE,
    insurance_certificate_received BOOLEAN DEFAULT FALSE,
    insurance_certificate_url TEXT,

    -- Compliance
    compliance_requirements TEXT,
    background_check_required BOOLEAN DEFAULT FALSE,
    background_check_completed BOOLEAN DEFAULT FALSE,
    licenses_required VARCHAR(255)[],
    licenses_verified BOOLEAN DEFAULT FALSE,

    certifications_required VARCHAR(255)[],
    certifications_verified BOOLEAN DEFAULT FALSE,

    -- Confidentiality
    nda_signed BOOLEAN DEFAULT FALSE,
    nda_signed_date DATE,
    confidentiality_terms TEXT,

    -- Indemnification
    indemnification_clause TEXT,
    liability_cap DECIMAL(12,2),

    -- Key Personnel
    account_manager_name VARCHAR(200),
    account_manager_email VARCHAR(255),
    account_manager_phone VARCHAR(50),

    technical_contact_name VARCHAR(200),
    technical_contact_email VARCHAR(255),
    technical_contact_phone VARCHAR(50),

    -- Internal Management
    contract_owner UUID,
    contract_owner_department VARCHAR(100),
    approver_id UUID,
    approver_name VARCHAR(200),

    -- Documents
    contract_document_url TEXT,
    signed_contract_url TEXT,
    amendments_urls TEXT[],
    related_documents_urls TEXT[],

    has_attachments BOOLEAN DEFAULT FALSE,
    attachment_count INTEGER DEFAULT 0,

    -- Amendments & Changes
    amendment_count INTEGER DEFAULT 0,
    last_amendment_date DATE,
    change_log JSONB, -- [{date, type, description, amended_by}]

    -- Approval Workflow
    requires_approval BOOLEAN DEFAULT TRUE,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,

    legal_review_required BOOLEAN DEFAULT FALSE,
    legal_reviewed BOOLEAN DEFAULT FALSE,
    legal_reviewed_by UUID,
    legal_review_date DATE,
    legal_review_notes TEXT,

    -- Alerts & Notifications
    alert_before_expiry_days INTEGER DEFAULT 60,
    expiry_alert_sent BOOLEAN DEFAULT FALSE,
    expiry_alert_date DATE,

    renewal_alert_sent BOOLEAN DEFAULT FALSE,
    insurance_expiry_alert_sent BOOLEAN DEFAULT FALSE,

    -- Performance Issues
    has_performance_issues BOOLEAN DEFAULT FALSE,
    performance_issues JSONB, -- [{date, issue, severity, resolution}]
    dispute_count INTEGER DEFAULT 0,
    disputes JSONB,

    -- Risk Assessment
    risk_level VARCHAR(20) CHECK (risk_level IN ('very_low', 'low', 'medium', 'high', 'very_high')),
    risk_factors TEXT,
    mitigation_plan TEXT,

    -- Related Contracts
    parent_contract_id UUID,
    related_contracts UUID[],
    supersedes_contract_id UUID,
    superseded_by_contract_id UUID,

    -- Metadata
    metadata JSONB,
    tags VARCHAR(100)[],
    notes TEXT,
    internal_notes TEXT,

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

-- Indexes for vendor_contracts
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

-- Composite Indexes for Common Queries
CREATE INDEX idx_vendor_contracts_property_status ON vendor_contracts(property_id, contract_status, end_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_property_active ON vendor_contracts(property_id, is_active, end_date) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_vendor_active ON vendor_contracts(vendor_name, is_active, start_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_vendor_contracts_expiring ON vendor_contracts(property_id, end_date) WHERE contract_status = 'active' AND end_date IS NOT NULL AND is_deleted = FALSE;

-- Comments
COMMENT ON TABLE vendor_contracts IS 'Manages vendor contracts, agreements, renewals, and compliance tracking';
COMMENT ON COLUMN vendor_contracts.contract_status IS 'Status: draft, pending_approval, approved, active, suspended, expired, terminated, renewed, cancelled';
COMMENT ON COLUMN vendor_contracts.payment_terms IS 'Payment terms: net_15, net_30, net_45, net_60, net_90, due_on_receipt, etc';
COMMENT ON COLUMN vendor_contracts.auto_renewal IS 'Whether contract automatically renews at end of term';
COMMENT ON COLUMN vendor_contracts.performance_issues IS 'JSON array of performance issues and resolutions';
