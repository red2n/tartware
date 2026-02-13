-- =====================================================
-- 02_data_breach_incidents.sql
-- Data breach incident tracking and notification workflow
-- Industry Standard: GDPR Art. 33/34 (72-hour notification)
-- Pattern: Workflow table with SLA tracking
-- Date: 2025-06-14
-- =====================================================

-- =====================================================
-- DATA_BREACH_INCIDENTS TABLE
-- Track data breaches, notifications, and remediation
-- =====================================================

CREATE TABLE IF NOT EXISTS data_breach_incidents (
    incident_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),        -- Unique incident identifier
    tenant_id UUID NOT NULL,                                        -- Owning tenant
    property_id UUID,                                               -- Affected property (NULL = tenant-wide)

    -- Incident Details
    incident_title VARCHAR(300) NOT NULL,                           -- Short description of the breach
    incident_description TEXT NOT NULL,                              -- Detailed description of what happened
    severity VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (severity IN (
        'low', 'medium', 'high', 'critical'
    )),                                                             -- Impact severity level
    breach_type VARCHAR(100) NOT NULL CHECK (breach_type IN (
        'unauthorized_access', 'data_loss', 'data_theft',
        'system_compromise', 'phishing', 'insider_threat',
        'ransomware', 'accidental_disclosure', 'other'
    )),                                                             -- Category of breach

    -- Timeline
    discovered_at TIMESTAMP WITH TIME ZONE NOT NULL,                -- When breach was discovered
    occurred_at TIMESTAMP WITH TIME ZONE,                           -- Estimated time breach occurred
    contained_at TIMESTAMP WITH TIME ZONE,                          -- When breach was contained
    resolved_at TIMESTAMP WITH TIME ZONE,                           -- When breach was fully resolved

    -- GDPR 72-Hour SLA
    notification_deadline TIMESTAMP WITH TIME ZONE,                 -- 72h from discovery per GDPR Art. 33
    authority_notified BOOLEAN DEFAULT FALSE,                       -- Supervisory authority notified
    authority_notified_at TIMESTAMP WITH TIME ZONE,                 -- When authority was notified
    authority_reference VARCHAR(200),                               -- Authority case reference number
    subjects_notified BOOLEAN DEFAULT FALSE,                        -- Data subjects notified (Art. 34)
    subjects_notified_at TIMESTAMP WITH TIME ZONE,                  -- When subjects were notified
    subjects_affected_count INTEGER,                                -- Estimated number of affected individuals

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'reported' CHECK (status IN (
        'reported', 'investigating', 'contained', 'notifying',
        'remediated', 'closed', 'escalated'
    )),                                                             -- Workflow status

    -- Data Categories Affected
    data_categories_affected TEXT[],                                 -- e.g., name, email, payment_card, passport
    systems_affected TEXT[],                                         -- Systems/services involved

    -- Response
    reported_by UUID,                                               -- User who reported the breach
    assigned_to UUID,                                               -- DPO or incident manager
    remediation_steps TEXT,                                         -- Actions taken to remediate
    root_cause TEXT,                                                -- Root cause analysis
    preventive_measures TEXT,                                       -- Measures to prevent recurrence

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                    -- Extension metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  -- Row creation
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  -- Row last update
    created_by UUID,                                                -- Creator
    updated_by UUID                                                 -- Last updater
);

CREATE INDEX IF NOT EXISTS idx_data_breach_incidents_tenant
    ON data_breach_incidents (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_data_breach_incidents_sla
    ON data_breach_incidents (notification_deadline)
    WHERE authority_notified = FALSE AND status NOT IN ('closed', 'remediated');

COMMENT ON TABLE data_breach_incidents IS 'Tracks data breach incidents, GDPR notification compliance, and remediation workflow.';
COMMENT ON COLUMN data_breach_incidents.notification_deadline IS '72 hours from discovery per GDPR Article 33 — deadline for supervisory authority notification';
COMMENT ON COLUMN data_breach_incidents.severity IS 'Impact severity: low (no PII), medium (limited PII), high (significant PII), critical (payment/identity data)';
COMMENT ON COLUMN data_breach_incidents.status IS 'Workflow status: reported → investigating → contained → notifying → remediated → closed';

\echo 'data_breach_incidents table created successfully!'
