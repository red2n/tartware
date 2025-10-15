-- =====================================================
-- 28_business_dates.sql
-- Property Business Date Management
--
-- Purpose: Track business date (vs. system date) for each property
-- Industry Standard: OPERA (BUSINESS_DATE), Cloudbeds (property_date),
--                    Protel (GESCHAEFTSDATUM), RMS (business_date)
--
-- Why This Matters:
-- - Hotels run on "business date" not system date
-- - Night audit advances business date (typically ~3am)
-- - Allows 24-hour operations without date confusion
-- - Critical for revenue allocation to correct date
--
-- Example: Guest checks in at 11pm Dec 31 but business date
-- is still Dec 31 until night audit runs at 3am Jan 1.
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS business_dates CASCADE;

CREATE TABLE business_dates (
    -- Primary Key
    business_date_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Date Information
    business_date DATE NOT NULL, -- Current business date for this property
    system_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Actual calendar date

    -- Status
    date_status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
        CHECK (date_status IN ('OPEN', 'CLOSED', 'IN_AUDIT')),

    -- Night Audit Information
    night_audit_status VARCHAR(20) DEFAULT 'PENDING'
        CHECK (night_audit_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
    night_audit_started_at TIMESTAMP,
    night_audit_completed_at TIMESTAMP,
    night_audit_started_by UUID, -- User who started audit
    night_audit_completed_by UUID, -- User who completed audit

    -- Previous Date Information
    previous_business_date DATE,
    date_rolled_at TIMESTAMP, -- When date was advanced
    date_rolled_by UUID, -- Who advanced the date

    -- Date Open/Close Times
    date_opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_opened_by UUID,
    date_closed_at TIMESTAMP,
    date_closed_by UUID,

    -- Statistics (for this business date)
    arrivals_count INTEGER DEFAULT 0,
    departures_count INTEGER DEFAULT 0,
    stayovers_count INTEGER DEFAULT 0,
    reservations_created INTEGER DEFAULT 0,
    reservations_cancelled INTEGER DEFAULT 0,
    total_revenue DECIMAL(12, 2) DEFAULT 0.00,
    total_payments DECIMAL(12, 2) DEFAULT 0.00,

    -- Operational Flags
    allow_new_reservations BOOLEAN DEFAULT TRUE,
    allow_check_ins BOOLEAN DEFAULT TRUE,
    allow_check_outs BOOLEAN DEFAULT TRUE,
    allow_postings BOOLEAN DEFAULT TRUE, -- Can charges be posted

    -- Lock Information (prevent changes during audit)
    is_locked BOOLEAN DEFAULT FALSE,
    locked_at TIMESTAMP,
    locked_by UUID,
    lock_reason VARCHAR(500),

    -- Audit Results
    audit_errors INTEGER DEFAULT 0,
    audit_warnings INTEGER DEFAULT 0,
    audit_notes TEXT,

    -- Reconciliation
    is_reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMP,
    reconciled_by UUID,

    -- Notes
    notes TEXT,

    -- Soft delete
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    -- Constraints
    CONSTRAINT uk_business_dates_property_date
        UNIQUE (tenant_id, property_id, business_date),

    -- Night audit completion requires start time
    CONSTRAINT chk_business_dates_audit_times
        CHECK (
            night_audit_completed_at IS NULL OR
            night_audit_started_at IS NOT NULL
        ),

    -- Closed status requires close timestamp
    CONSTRAINT chk_business_dates_closed
        CHECK (
            date_status != 'CLOSED' OR
            date_closed_at IS NOT NULL
        )
);

-- Add table comment
COMMENT ON TABLE business_dates IS 'Property business date tracking. Hotels operate on business date (not system date) which advances during night audit.';

-- Add column comments
COMMENT ON COLUMN business_dates.business_date IS 'Current business date for property (may differ from calendar date)';
COMMENT ON COLUMN business_dates.system_date IS 'Actual calendar date';
COMMENT ON COLUMN business_dates.date_status IS 'OPEN (active), CLOSED (archived), IN_AUDIT (night audit running)';
COMMENT ON COLUMN business_dates.night_audit_status IS 'Status of night audit process';
COMMENT ON COLUMN business_dates.date_rolled_at IS 'Timestamp when date was advanced to next day';
COMMENT ON COLUMN business_dates.allow_postings IS 'Whether charges can be posted to this business date';
COMMENT ON COLUMN business_dates.is_locked IS 'TRUE during night audit to prevent changes';
COMMENT ON COLUMN business_dates.arrivals_count IS 'Number of check-ins for this business date';
COMMENT ON COLUMN business_dates.departures_count IS 'Number of check-outs for this business date';
COMMENT ON COLUMN business_dates.stayovers_count IS 'Number of guests staying over (not checking in/out)';

-- Create partial unique index for one OPEN date per property
CREATE UNIQUE INDEX idx_uk_business_dates_open_per_property
    ON business_dates(tenant_id, property_id, date_status)
    WHERE (date_status = 'OPEN' AND deleted_at IS NULL);

-- Create indexes (will be created via indexes file)
-- CREATE INDEX idx_business_dates_tenant ON business_dates(tenant_id, property_id, business_date DESC);
-- CREATE INDEX idx_business_dates_status ON business_dates(property_id, date_status) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_business_dates_open ON business_dates(property_id, business_date) WHERE date_status = 'OPEN';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON business_dates TO tartware_app;

-- Success message
\echo '✓ Table created: business_dates (28/37)'
\echo '  - Business date tracking'
\echo '  - Night audit support'
\echo '  - Date roll management'
\echo ''
