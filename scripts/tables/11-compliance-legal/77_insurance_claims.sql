-- =====================================================
-- Insurance Claims Table
-- =====================================================
-- Purpose: Track insurance claims and processing
-- Key Features:
--   - Claim management
--   - Documentation tracking
--   - Settlement processing
--   - Recovery tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS insurance_claims (
    -- Primary Key
    claim_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Claim Identification
    claim_number VARCHAR(100) UNIQUE NOT NULL,
    insurance_claim_number VARCHAR(100),
    policy_number VARCHAR(100) NOT NULL,

    -- Claim Type
    claim_type VARCHAR(100) CHECK (claim_type IN (
        'property_damage', 'liability', 'workers_comp', 'business_interruption',
        'theft', 'fire', 'flood', 'equipment_breakdown', 'cyber',
        'guest_injury', 'employee_injury', 'vehicle', 'other'
    )),

    claim_category VARCHAR(100),

    -- Insurance Details
    insurance_company VARCHAR(255) NOT NULL,
    insurance_policy_type VARCHAR(100),
    policy_effective_date DATE,
    policy_expiry_date DATE,

    insurance_agent_name VARCHAR(255),
    insurance_agent_contact VARCHAR(255),
    insurance_agent_email VARCHAR(255),

    -- Incident Details
    incident_date DATE NOT NULL,
    incident_time TIME,
    incident_description TEXT NOT NULL,
    incident_location VARCHAR(255),

    incident_report_id UUID,
    police_report_id UUID,

    room_id UUID,
    room_number VARCHAR(50),

    -- Claim Status
    claim_status VARCHAR(50) DEFAULT 'draft' CHECK (claim_status IN (
        'draft', 'submitted', 'under_review', 'investigating',
        'approved', 'partially_approved', 'denied', 'settled',
        'closed', 'appealed', 'withdrawn'
    )),

    -- Dates
    claim_filed_date DATE NOT NULL,
    claim_received_date DATE,
    investigation_started_date DATE,
    decision_date DATE,
    settlement_date DATE,
    closure_date DATE,

    -- Claimant
    claimant_type VARCHAR(50) CHECK (claimant_type IN (
        'property', 'guest', 'employee', 'third_party', 'vendor'
    )),
    claimant_name VARCHAR(255),
    claimant_contact VARCHAR(255),
    claimant_address TEXT,

    guest_id UUID,
    employee_id UUID,

    -- Claim Amount
    claim_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    deductible_amount DECIMAL(12,2),
    coverage_limit DECIMAL(12,2),

    -- Approved/Settled Amount
    approved_amount DECIMAL(12,2),
    settlement_amount DECIMAL(12,2),
    payment_received DECIMAL(12,2) DEFAULT 0.00,
    outstanding_amount DECIMAL(12,2),

    -- Loss Details
    loss_type VARCHAR(100),
    loss_description TEXT,
    cause_of_loss TEXT,

    property_damaged TEXT,
    estimated_repair_cost DECIMAL(12,2),
    actual_repair_cost DECIMAL(12,2),

    -- Injuries (if applicable)
    injuries_reported BOOLEAN DEFAULT FALSE,
    injury_description TEXT,
    medical_treatment_required BOOLEAN DEFAULT FALSE,
    medical_costs DECIMAL(12,2),

    -- Business Interruption
    business_interruption BOOLEAN DEFAULT FALSE,
    interruption_start_date DATE,
    interruption_end_date DATE,
    lost_revenue DECIMAL(12,2),

    -- Investigation
    investigation_required BOOLEAN DEFAULT TRUE,
    investigator_name VARCHAR(255),
    investigator_company VARCHAR(255),
    investigator_contact VARCHAR(255),

    investigation_findings TEXT,
    investigation_report_url TEXT,

    -- Liability
    liability_admitted BOOLEAN,
    liability_percentage DECIMAL(5,2),
    third_party_liability BOOLEAN DEFAULT FALSE,
    third_party_details TEXT,

    -- Adjuster
    adjuster_assigned BOOLEAN DEFAULT FALSE,
    adjuster_name VARCHAR(255),
    adjuster_contact VARCHAR(255),
    adjuster_visit_date DATE,
    adjuster_report_url TEXT,

    -- Documentation
    documentation_complete BOOLEAN DEFAULT FALSE,
    required_documents VARCHAR(255)[],
    submitted_documents VARCHAR(255)[],

    photos_submitted INTEGER DEFAULT 0,
    photo_urls TEXT[],

    repair_estimates_count INTEGER DEFAULT 0,
    repair_estimate_urls TEXT[],

    invoices_submitted INTEGER DEFAULT 0,
    invoice_urls TEXT[],

    -- Witnesses
    witness_statements_collected BOOLEAN DEFAULT FALSE,
    witness_count INTEGER DEFAULT 0,
    witnesses JSONB, -- [{name, contact, statement}]

    -- Denial/Dispute
    denied BOOLEAN DEFAULT FALSE,
    denial_reason TEXT,
    denial_date DATE,

    appealed BOOLEAN DEFAULT FALSE,
    appeal_submitted_date DATE,
    appeal_outcome VARCHAR(100),
    appeal_notes TEXT,

    -- Settlement
    settlement_offered BOOLEAN DEFAULT FALSE,
    settlement_offer_amount DECIMAL(12,2),
    settlement_offer_date DATE,

    settlement_accepted BOOLEAN DEFAULT FALSE,
    settlement_accepted_date DATE,
    settlement_terms TEXT,

    -- Payment
    payment_method VARCHAR(100),
    payment_reference VARCHAR(100),
    payment_date DATE,
    payment_received_by UUID,

    payment_schedule JSONB, -- [{amount, due_date, paid, paid_date}]

    -- Recovery/Subrogation
    subrogation_potential BOOLEAN DEFAULT FALSE,
    subrogation_amount DECIMAL(12,2),
    subrogation_pursued BOOLEAN DEFAULT FALSE,
    subrogation_recovered DECIMAL(12,2),

    -- Legal Action
    legal_action_required BOOLEAN DEFAULT FALSE,
    lawyer_assigned VARCHAR(255),
    legal_case_number VARCHAR(100),
    legal_notes TEXT,

    -- Notifications
    insurer_notified BOOLEAN DEFAULT FALSE,
    insurer_notification_date DATE,

    management_notified BOOLEAN DEFAULT FALSE,
    corporate_notified BOOLEAN DEFAULT FALSE,

    -- Review & Approval
    internal_review_required BOOLEAN DEFAULT FALSE,
    reviewed_by UUID,
    review_date DATE,
    review_notes TEXT,

    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approval_date DATE,

    -- Follow-up
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    follow_up_notes TEXT,

    -- Related Claims
    related_claim_ids UUID[],
    parent_claim_id UUID,

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
