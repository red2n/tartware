-- =====================================================
-- Incident Reports Table
-- =====================================================
-- Purpose: Document and track incidents, accidents, and security events
-- Key Features:
--   - Comprehensive incident documentation
--   - Investigation tracking
--   - Follow-up management
--   - Compliance reporting
-- =====================================================

CREATE TABLE IF NOT EXISTS incident_reports (
    -- Primary Key
    incident_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Incident Identification
    incident_number VARCHAR(50) UNIQUE NOT NULL,
    incident_title VARCHAR(255) NOT NULL,

    -- Incident Classification
    incident_type VARCHAR(100) NOT NULL CHECK (incident_type IN (
        'accident', 'injury', 'illness', 'theft', 'damage', 'fire',
        'security_breach', 'guest_complaint', 'staff_misconduct',
        'food_poisoning', 'slip_fall', 'equipment_failure',
        'medical_emergency', 'death', 'violence', 'harassment',
        'property_damage', 'natural_disaster', 'other'
    )),
    incident_category VARCHAR(100),
    incident_subcategory VARCHAR(100),

    -- Severity
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('minor', 'moderate', 'serious', 'critical', 'catastrophic')),
    severity_score INTEGER CHECK (severity_score BETWEEN 1 AND 10),

    -- Date & Time
    incident_date DATE NOT NULL,
    incident_time TIME NOT NULL,
    incident_datetime TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Discovery
    discovered_date DATE,
    discovered_time TIME,
    discovered_by UUID,
    discovered_by_name VARCHAR(200),
    time_to_discovery_minutes INTEGER,

    -- Location
    incident_location VARCHAR(255) NOT NULL,
    room_number VARCHAR(20),
    room_id UUID,
    floor_number INTEGER,
    area_name VARCHAR(100),
    specific_location TEXT,

    -- Detailed Description
    incident_description TEXT NOT NULL,
    sequence_of_events TEXT,
    contributing_factors TEXT,
    root_cause TEXT,

    -- People Involved
    guest_involved BOOLEAN DEFAULT FALSE,
    guest_id UUID,
    guest_name VARCHAR(200),
    guest_room_number VARCHAR(20),

    staff_involved BOOLEAN DEFAULT FALSE,
    staff_ids UUID[],
    staff_names VARCHAR(200)[],

    third_party_involved BOOLEAN DEFAULT FALSE,
    third_party_details TEXT,

    witness_count INTEGER DEFAULT 0,
    witnesses JSONB, -- [{name, contact, statement}]

    -- Injuries & Medical
    injuries_sustained BOOLEAN DEFAULT FALSE,
    injury_details TEXT,
    injury_severity VARCHAR(50) CHECK (injury_severity IN ('none', 'minor', 'moderate', 'serious', 'critical', 'fatal')),

    medical_attention_required BOOLEAN DEFAULT FALSE,
    medical_attention_provided BOOLEAN DEFAULT FALSE,
    medical_provider VARCHAR(255),
    ambulance_called BOOLEAN DEFAULT FALSE,
    hospital_name VARCHAR(255),
    medical_report_number VARCHAR(100),

    -- Fatality
    fatality_involved BOOLEAN DEFAULT FALSE,
    fatality_details TEXT,
    coroner_notified BOOLEAN DEFAULT FALSE,

    -- Property Damage
    property_damage BOOLEAN DEFAULT FALSE,
    damage_description TEXT,
    estimated_damage_cost DECIMAL(10,2),
    actual_damage_cost DECIMAL(10,2),

    -- Financial Impact
    financial_loss DECIMAL(12,2),
    insurance_claim_filed BOOLEAN DEFAULT FALSE,
    insurance_claim_number VARCHAR(100),
    insurance_company VARCHAR(255),
    claim_amount DECIMAL(12,2),

    -- Immediate Actions
    immediate_actions_taken TEXT NOT NULL,
    first_responder UUID,
    first_responder_name VARCHAR(200),
    emergency_services_called BOOLEAN DEFAULT FALSE,
    emergency_service_types VARCHAR(100)[], -- ['police', 'fire', 'ambulance']

    -- Law Enforcement
    police_notified BOOLEAN DEFAULT FALSE,
    police_report_number VARCHAR(100),
    police_department VARCHAR(255),
    officer_name VARCHAR(200),
    officer_badge_number VARCHAR(50),
    police_report_filed BOOLEAN DEFAULT FALSE,

    -- Status
    incident_status VARCHAR(50) DEFAULT 'reported' CHECK (incident_status IN (
        'reported', 'under_investigation', 'investigated', 'resolved',
        'closed', 'pending', 'escalated', 'legal_action'
    )),

    -- Investigation
    investigation_required BOOLEAN DEFAULT FALSE,
    investigation_started BOOLEAN DEFAULT FALSE,
    investigation_start_date DATE,
    investigated_by UUID,
    investigator_name VARCHAR(200),
    investigation_completed BOOLEAN DEFAULT FALSE,
    investigation_completion_date DATE,
    investigation_findings TEXT,
    investigation_report_url TEXT,

    -- Follow-up
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_actions JSONB, -- [{action, assigned_to, due_date, status}]
    follow_up_completed BOOLEAN DEFAULT FALSE,

    -- Corrective Actions
    corrective_actions_required BOOLEAN DEFAULT FALSE,
    corrective_actions TEXT,
    preventive_measures TEXT,
    corrective_actions_implemented BOOLEAN DEFAULT FALSE,
    implementation_date DATE,
    implementation_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID,

    -- Notifications
    management_notified BOOLEAN DEFAULT FALSE,
    management_notified_at TIMESTAMP WITH TIME ZONE,
    management_id UUID,

    owner_notified BOOLEAN DEFAULT FALSE,
    owner_notified_at TIMESTAMP WITH TIME ZONE,

    corporate_notified BOOLEAN DEFAULT FALSE,
    corporate_notified_at TIMESTAMP WITH TIME ZONE,

    -- Regulatory Compliance
    regulatory_reporting_required BOOLEAN DEFAULT FALSE,
    regulatory_authorities_notified VARCHAR(255)[],
    osha_reportable BOOLEAN DEFAULT FALSE,
    osha_report_filed BOOLEAN DEFAULT FALSE,
    osha_report_number VARCHAR(100),

    -- Media Involvement
    media_attention BOOLEAN DEFAULT FALSE,
    media_statement_issued BOOLEAN DEFAULT FALSE,
    media_contact VARCHAR(255),
    public_relations_involved BOOLEAN DEFAULT FALSE,

    -- Legal
    legal_action_taken BOOLEAN DEFAULT FALSE,
    legal_case_number VARCHAR(100),
    attorney_assigned VARCHAR(255),
    lawsuit_filed BOOLEAN DEFAULT FALSE,
    settlement_reached BOOLEAN DEFAULT FALSE,
    settlement_amount DECIMAL(12,2),

    -- Documentation
    photos_taken BOOLEAN DEFAULT FALSE,
    photo_count INTEGER DEFAULT 0,
    photo_urls TEXT[],

    video_footage_available BOOLEAN DEFAULT FALSE,
    video_urls TEXT[],

    documents_attached BOOLEAN DEFAULT FALSE,
    document_urls TEXT[],

    evidence_collected BOOLEAN DEFAULT FALSE,
    evidence_description TEXT,
    evidence_location VARCHAR(255),

    -- Review & Approval
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,

    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,

    -- Closure
    closed BOOLEAN DEFAULT FALSE,
    closed_by UUID,
    closed_at TIMESTAMP WITH TIME ZONE,
    closure_notes TEXT,

    -- Lessons Learned
    lessons_learned TEXT,
    training_required BOOLEAN DEFAULT FALSE,
    training_topics VARCHAR(255)[],
    policy_changes_needed BOOLEAN DEFAULT FALSE,
    policy_recommendations TEXT,

    -- Related Incidents
    related_incidents UUID[],
    is_recurring_incident BOOLEAN DEFAULT FALSE,
    previous_similar_incidents INTEGER DEFAULT 0,

    -- Confidentiality
    is_confidential BOOLEAN DEFAULT FALSE,
    confidentiality_level VARCHAR(50) CHECK (confidentiality_level IN ('public', 'internal', 'restricted', 'confidential', 'secret')),
    access_restricted_to UUID[],

    -- Metadata
    metadata JSONB,
    tags VARCHAR(100)[],
    notes TEXT,

    -- Standard Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- Indexes for incident_reports

-- Composite Indexes for Common Queries

-- Comments
COMMENT ON TABLE incident_reports IS 'Comprehensive incident documentation including accidents, injuries, security events, and investigations';
COMMENT ON COLUMN incident_reports.severity IS 'Incident severity: minor, moderate, serious, critical, catastrophic';
COMMENT ON COLUMN incident_reports.incident_type IS 'Type: accident, injury, theft, damage, security_breach, medical_emergency, etc';
COMMENT ON COLUMN incident_reports.witnesses IS 'JSON array of witness information and statements';
COMMENT ON COLUMN incident_reports.follow_up_actions IS 'JSON array of required follow-up actions with assignments and deadlines';

\echo 'incident_reports table created successfully!'
