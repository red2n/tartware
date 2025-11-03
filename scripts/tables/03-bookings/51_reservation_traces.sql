-- =====================================================
-- 51_reservation_traces.sql
-- Reservation Trace & Task Management
--
-- Purpose: Manage front-office follow-up tasks (traces) linked to
--          reservations, mirroring OPERA trace functionality.
-- =====================================================

\c tartware

\echo 'Creating reservation_traces table...'

CREATE TABLE IF NOT EXISTS reservation_traces (
    -- Primary Key
    trace_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Associations
    reservation_id UUID NOT NULL,
    guest_id UUID,
    assigned_to UUID,
    created_by UUID,

    -- Trace Details
    trace_type VARCHAR(50) NOT NULL CHECK (trace_type IN ('PRE_ARRIVAL', 'IN_HOUSE', 'POST_STAY', 'VIP', 'BILLING', 'MAINTENANCE', 'OTHER')),
    trace_category VARCHAR(50),
    subject VARCHAR(200) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    due_date DATE NOT NULL,
    due_time TIME,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED')),
    completed_at TIMESTAMP,
    completed_by UUID,
    completion_notes TEXT,

    -- Alerts
    alert_channels VARCHAR(30)[] DEFAULT ARRAY['FRONT_DESK'],
    alert_trigger VARCHAR(50) DEFAULT 'ARRIVAL' CHECK (alert_trigger IN ('IMMEDIATE', 'ARRIVAL', 'DEPARTURE', 'SPECIFIC_TIME')),
    snoozed_until TIMESTAMP,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID
);

COMMENT ON TABLE reservation_traces IS 'Front-desk follow up tasks tied to reservations (OPERA-style traces).';
COMMENT ON COLUMN reservation_traces.trace_type IS 'Trace context (PRE_ARRIVAL, IN_HOUSE, etc.).';
COMMENT ON COLUMN reservation_traces.alert_channels IS 'Channels to alert (FRONT_DESK, EMAIL, SMS).';
COMMENT ON COLUMN reservation_traces.status IS 'Trace lifecycle status.';

\echo '✓ Table created: reservation_traces'
