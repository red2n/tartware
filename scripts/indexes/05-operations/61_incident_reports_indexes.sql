-- =====================================================
-- 61_incident_reports_indexes.sql
-- Incident Reports Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating incident_reports indexes...'

CREATE INDEX idx_incident_reports_tenant ON incident_reports(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_property ON incident_reports(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_number ON incident_reports(incident_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_type ON incident_reports(incident_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_severity ON incident_reports(severity) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_date ON incident_reports(incident_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_datetime ON incident_reports(incident_datetime DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_status ON incident_reports(incident_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_open ON incident_reports(incident_status) WHERE incident_status NOT IN ('resolved', 'closed') AND is_deleted = FALSE;
CREATE INDEX idx_incident_reports_guest ON incident_reports(guest_id) WHERE guest_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_incident_reports_room ON incident_reports(room_id) WHERE room_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_incident_reports_injuries ON incident_reports(injuries_sustained, injury_severity) WHERE injuries_sustained = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_incident_reports_fatality ON incident_reports(fatality_involved) WHERE fatality_involved = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_incident_reports_investigation ON incident_reports(investigation_required, investigation_completed) WHERE investigation_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_incident_reports_follow_up ON incident_reports(follow_up_required, follow_up_completed) WHERE follow_up_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_incident_reports_corrective_actions ON incident_reports(corrective_actions_required, corrective_actions_implemented) WHERE corrective_actions_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_incident_reports_legal ON incident_reports(legal_action_taken) WHERE legal_action_taken = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_incident_reports_regulatory ON incident_reports(regulatory_reporting_required) WHERE regulatory_reporting_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_incident_reports_osha ON incident_reports(osha_reportable, osha_report_filed) WHERE osha_reportable = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_incident_reports_insurance ON incident_reports(insurance_claim_filed) WHERE insurance_claim_filed = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_incident_reports_closed ON incident_reports(closed) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_confidential ON incident_reports(is_confidential, confidentiality_level) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_witnesses ON incident_reports USING gin(witnesses) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_metadata ON incident_reports USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_tags ON incident_reports USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_property_date ON incident_reports(property_id, incident_date DESC, severity) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_property_status ON incident_reports(property_id, incident_status, incident_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_property_type ON incident_reports(property_id, incident_type, incident_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_incident_reports_recent_open ON incident_reports(property_id, incident_date DESC) WHERE incident_status NOT IN ('resolved', 'closed') AND is_deleted = FALSE;

\echo 'Incident Reports indexes created successfully!'
