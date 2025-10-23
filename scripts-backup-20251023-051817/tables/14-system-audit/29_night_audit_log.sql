-- =====================================================
-- 29_night_audit_log.sql
-- Night Audit Process Log
--
-- Purpose: Detailed log of night audit (EOD) process execution
-- Industry Standard: OPERA (NIGHT_AUDIT_LOG), Cloudbeds (eod_log),
--                    Protel (TAGESABSCHLUSS_LOG), RMS (eod_process_log)
--
-- Night Audit Process:
-- 1. Lock property (prevent changes)
-- 2. Post room charges
-- 3. Post no-show charges
-- 4. Run scheduled reports
-- 5. Calculate statistics
-- 6. Advance business date
-- 7. Unlock property
--
-- Tracks each step for troubleshooting and compliance
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS night_audit_log CASCADE;

CREATE TABLE night_audit_log (
    -- Primary Key
    audit_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Audit Run Information
    audit_run_id UUID NOT NULL, -- Groups all steps of one audit run
    business_date_id UUID, -- Reference to business_dates record

    -- Date Information
    business_date DATE NOT NULL, -- Date being closed
    next_business_date DATE, -- Date being opened

    -- Timing
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,

    -- Status
    audit_status VARCHAR(20) NOT NULL DEFAULT 'STARTED'
        CHECK (audit_status IN ('STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED')),

    -- Step Information
    step_number INTEGER NOT NULL, -- Sequential step in audit process
    step_name VARCHAR(100) NOT NULL, -- e.g., "Post Room Charges", "Calculate Statistics"
    step_category VARCHAR(50), -- POSTING, REPORTING, CALCULATION, SYSTEM
    step_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (step_status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED')),

    step_started_at TIMESTAMP,
    step_completed_at TIMESTAMP,
    step_duration_ms INTEGER,

    -- Results
    records_processed INTEGER DEFAULT 0,
    records_succeeded INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,

    -- Financial Totals (for posting steps)
    amount_posted DECIMAL(12, 2),
    transactions_created INTEGER,

    -- Error Handling
    error_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    error_message TEXT,
    error_details JSONB,
    stack_trace TEXT,

    -- User Information
    initiated_by UUID NOT NULL, -- User who started audit
    completed_by UUID,

    -- Execution Mode
    execution_mode VARCHAR(20) DEFAULT 'MANUAL'
        CHECK (execution_mode IN ('MANUAL', 'SCHEDULED', 'AUTOMATIC')),
    is_test_run BOOLEAN DEFAULT FALSE,

    -- Process Details
    process_details JSONB, -- Step-specific data
    configuration JSONB, -- Audit configuration used

    -- Statistics Captured
    occupancy_percent DECIMAL(5, 2),
    adr DECIMAL(10, 2), -- Average Daily Rate
    revpar DECIMAL(10, 2), -- Revenue Per Available Room
    total_revenue DECIMAL(12, 2),
    total_rooms_sold INTEGER,
    total_arrivals INTEGER,
    total_departures INTEGER,
    total_stayovers INTEGER,

    -- Flags
    is_successful BOOLEAN,
    requires_attention BOOLEAN DEFAULT FALSE,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    acknowledged_by UUID,

    -- Reports Generated
    reports_generated TEXT[], -- Array of report names

    -- Actions Taken
    actions_taken TEXT[], -- Array of automated actions

    -- Notes
    notes TEXT,
    resolution_notes TEXT, -- For failed audits

    -- Retry Information
    retry_count INTEGER DEFAULT 0,
    previous_attempt_id UUID, -- Reference to previous failed attempt

    -- Soft delete (audit logs typically not deleted)
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    -- Constraints
    -- Ensure completed steps have completion time
    CONSTRAINT chk_night_audit_step_completed
        CHECK (
            step_status != 'COMPLETED' OR
            step_completed_at IS NOT NULL
        ),

    -- Duration should be positive
    CONSTRAINT chk_night_audit_duration
        CHECK (
            duration_seconds IS NULL OR
            duration_seconds >= 0
        )
);

-- Add table comment
COMMENT ON TABLE night_audit_log IS 'Detailed log of night audit (EOD) process. Tracks each step for troubleshooting and compliance.';

-- Add column comments
COMMENT ON COLUMN night_audit_log.audit_run_id IS 'Groups all steps of a single audit run';
COMMENT ON COLUMN night_audit_log.business_date IS 'Business date being closed by this audit';
COMMENT ON COLUMN night_audit_log.next_business_date IS 'New business date after audit completes';
COMMENT ON COLUMN night_audit_log.step_number IS 'Sequential step number in audit process';
COMMENT ON COLUMN night_audit_log.step_name IS 'Human-readable step name (e.g., "Post Room Charges")';
COMMENT ON COLUMN night_audit_log.step_category IS 'POSTING, REPORTING, CALCULATION, SYSTEM';
COMMENT ON COLUMN night_audit_log.records_processed IS 'Total records processed by this step';
COMMENT ON COLUMN night_audit_log.execution_mode IS 'MANUAL (user-initiated), SCHEDULED (cron), AUTOMATIC (trigger)';
COMMENT ON COLUMN night_audit_log.is_test_run IS 'TRUE if this is a test audit (no actual changes)';
COMMENT ON COLUMN night_audit_log.adr IS 'Average Daily Rate calculated during audit';
COMMENT ON COLUMN night_audit_log.revpar IS 'Revenue Per Available Room calculated during audit';
COMMENT ON COLUMN night_audit_log.requires_attention IS 'TRUE if errors/warnings need review';

-- Create indexes (will be created via indexes file)
-- CREATE INDEX idx_night_audit_tenant ON night_audit_log(tenant_id, property_id, business_date DESC);
-- CREATE INDEX idx_night_audit_run ON night_audit_log(audit_run_id, step_number);
-- CREATE INDEX idx_night_audit_status ON night_audit_log(property_id, audit_status, started_at DESC);
-- CREATE INDEX idx_night_audit_attention ON night_audit_log(property_id, requires_attention) WHERE requires_attention = TRUE;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON night_audit_log TO tartware_app;

-- Success message
\echo '✓ Table created: night_audit_log (29/37)'
\echo '  - EOD process tracking'
\echo '  - Step-by-step audit log'
\echo '  - Performance metrics'
\echo ''
