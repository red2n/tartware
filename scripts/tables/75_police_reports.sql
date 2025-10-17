-- =====================================================
-- Police Reports Table
-- =====================================================
-- Purpose: Track police/law enforcement incident reports
-- Key Features:
--   - Incident documentation
--   - Case tracking
--   - Evidence management
--   - Follow-up tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS police_reports (
    -- Primary Key
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Report Identification
    report_number VARCHAR(100) UNIQUE NOT NULL,
    police_case_number VARCHAR(100),
    police_report_number VARCHAR(100),

    -- Incident Reference
    incident_id UUID,
    incident_report_id UUID,

    -- Incident Details
    incident_date DATE NOT NULL,
    incident_time TIME,
    reported_date DATE NOT NULL,
    reported_time TIME,

    incident_type VARCHAR(100) CHECK (incident_type IN (
        'theft', 'assault', 'vandalism', 'trespassing', 'fraud',
        'suspicious_activity', 'missing_person', 'death', 'drug_related',
        'domestic_disturbance', 'noise_complaint', 'vehicle_incident', 'other'
    )),

    incident_description TEXT NOT NULL,
    incident_location VARCHAR(255),

    room_id UUID,
    room_number VARCHAR(50),

    -- Law Enforcement Agency
    agency_name VARCHAR(255) NOT NULL,
    agency_jurisdiction VARCHAR(255),
    agency_contact_number VARCHAR(50),
    agency_email VARCHAR(255),

    -- Officers
    responding_officer_name VARCHAR(255),
    responding_officer_badge VARCHAR(100),
    responding_officer_contact VARCHAR(50),

    additional_officers JSONB, -- [{name, badge, role}]

    -- Report Status
    report_status VARCHAR(50) DEFAULT 'filed' CHECK (report_status IN (
        'filed', 'under_investigation', 'closed', 'charges_filed',
        'no_action', 'referred', 'pending'
    )),

    -- People Involved
    suspect_count INTEGER DEFAULT 0,
    suspects JSONB, -- [{name, description, guest_id, arrested, charges}]

    victim_count INTEGER DEFAULT 0,
    victims JSONB, -- [{name, guest_id, injuries, statement}]

    witness_count INTEGER DEFAULT 0,
    witnesses JSONB, -- [{name, guest_id, contact, statement}]

    -- Guest/Staff Involvement
    guest_involved BOOLEAN DEFAULT FALSE,
    guest_ids UUID[],

    staff_involved BOOLEAN DEFAULT FALSE,
    staff_ids UUID[],

    -- Property/Evidence
    property_stolen BOOLEAN DEFAULT FALSE,
    stolen_items JSONB, -- [{description, value, recovered}]
    total_loss_value DECIMAL(12,2),

    property_damaged BOOLEAN DEFAULT FALSE,
    damage_description TEXT,
    damage_value DECIMAL(12,2),

    evidence_collected BOOLEAN DEFAULT FALSE,
    evidence_items JSONB, -- [{description, collected_by, location}]
    evidence_tags VARCHAR(100)[],

    -- Medical Response
    medical_response_required BOOLEAN DEFAULT FALSE,
    ambulance_called BOOLEAN DEFAULT FALSE,
    hospital_transport BOOLEAN DEFAULT FALSE,
    hospital_name VARCHAR(255),

    injuries_reported BOOLEAN DEFAULT FALSE,
    injury_details TEXT,

    -- Arrests
    arrests_made BOOLEAN DEFAULT FALSE,
    arrest_count INTEGER DEFAULT 0,
    arrested_persons JSONB, -- [{name, charges, bail, custody_status}]

    -- Investigation
    investigation_ongoing BOOLEAN DEFAULT FALSE,
    lead_investigator_name VARCHAR(255),
    lead_investigator_contact VARCHAR(50),

    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    follow_up_notes TEXT,

    -- Court Proceedings
    court_case_filed BOOLEAN DEFAULT FALSE,
    court_case_number VARCHAR(100),
    court_date DATE,
    court_jurisdiction VARCHAR(255),

    charges_filed VARCHAR(255)[],

    -- Hotel Actions
    hotel_action_taken TEXT,
    guest_evicted BOOLEAN DEFAULT FALSE,
    guest_banned BOOLEAN DEFAULT FALSE,

    security_measures_enhanced BOOLEAN DEFAULT FALSE,
    security_enhancements TEXT,

    -- Insurance
    insurance_claim_filed BOOLEAN DEFAULT FALSE,
    insurance_claim_number VARCHAR(100),
    insurance_company VARCHAR(255),

    -- Documentation
    police_report_copy_url TEXT,
    photos_urls TEXT[],
    video_evidence_urls TEXT[],

    has_documentation BOOLEAN DEFAULT FALSE,
    documentation_urls TEXT[],

    -- Notifications
    management_notified BOOLEAN DEFAULT FALSE,
    management_notified_at TIMESTAMP WITH TIME ZONE,

    corporate_notified BOOLEAN DEFAULT FALSE,
    legal_counsel_notified BOOLEAN DEFAULT FALSE,

    -- Confidentiality
    confidential BOOLEAN DEFAULT TRUE,
    restricted_access BOOLEAN DEFAULT TRUE,
    authorized_viewers UUID[],

    -- Resolution
    resolved BOOLEAN DEFAULT FALSE,
    resolution_date DATE,
    resolution_description TEXT,
    outcome VARCHAR(255),

    -- Related Reports
    related_report_ids UUID[],
    parent_report_id UUID,

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
CREATE INDEX idx_police_reports_tenant ON police_reports(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_police_reports_property ON police_reports(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_police_reports_number ON police_reports(report_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_police_reports_police_case ON police_reports(police_case_number) WHERE police_case_number IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_police_reports_incident ON police_reports(incident_id) WHERE incident_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_police_reports_incident_report ON police_reports(incident_report_id) WHERE incident_report_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_police_reports_incident_date ON police_reports(incident_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_police_reports_incident_type ON police_reports(incident_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_police_reports_status ON police_reports(report_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_police_reports_room ON police_reports(room_id) WHERE room_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_police_reports_agency ON police_reports(agency_name) WHERE is_deleted = FALSE;
CREATE INDEX idx_police_reports_investigation ON police_reports(investigation_ongoing) WHERE investigation_ongoing = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_police_reports_follow_up ON police_reports(follow_up_required, follow_up_date) WHERE follow_up_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_police_reports_court_case ON police_reports(court_case_filed, court_date) WHERE court_case_filed = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_police_reports_arrests ON police_reports(arrests_made) WHERE arrests_made = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_police_reports_insurance ON police_reports(insurance_claim_filed) WHERE insurance_claim_filed = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_police_reports_resolved ON police_reports(resolved, resolution_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_police_reports_confidential ON police_reports(confidential, restricted_access) WHERE is_deleted = FALSE;
CREATE INDEX idx_police_reports_parent ON police_reports(parent_report_id) WHERE parent_report_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_police_reports_metadata ON police_reports USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_police_reports_tags ON police_reports USING gin(tags) WHERE is_deleted = FALSE;

CREATE INDEX idx_police_reports_property_type ON police_reports(property_id, incident_type, incident_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_police_reports_property_status ON police_reports(property_id, report_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_police_reports_property_ongoing ON police_reports(property_id, investigation_ongoing) WHERE investigation_ongoing = TRUE AND is_deleted = FALSE;

COMMENT ON TABLE police_reports IS 'Tracks police/law enforcement reports with case and evidence management';
