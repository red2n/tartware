-- =====================================================
-- 75_police_reports_indexes.sql
-- Police Reports Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating police_reports indexes...'

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

\echo 'Police Reports indexes created successfully!'
