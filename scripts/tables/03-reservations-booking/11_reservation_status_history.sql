-- =====================================================
-- reservation_status_history.sql
-- Reservation Status History Table
-- Industry Standard: Audit trail for reservation changes
-- Pattern: Oracle OPERA History Log, Event Sourcing
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating reservation_status_history table...'

-- =====================================================
-- RESERVATION_STATUS_HISTORY TABLE
-- Audit trail: Track all status changes
-- Event sourcing pattern
-- =====================================================

CREATE TABLE IF NOT EXISTS reservation_status_history (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign Keys
    reservation_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    -- Status Change
    previous_status reservation_status,
    new_status reservation_status NOT NULL,

    -- Change Details
    change_reason VARCHAR(255),
    change_notes TEXT,

    -- Changed By
    changed_by VARCHAR(100),
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Additional Context
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE reservation_status_history IS 'Audit trail for reservation status changes';
COMMENT ON COLUMN reservation_status_history.id IS 'Unique history record identifier (UUID)';
COMMENT ON COLUMN reservation_status_history.reservation_id IS 'Reference to reservations.id';
COMMENT ON COLUMN reservation_status_history.previous_status IS 'Previous status (NULL for initial)';
COMMENT ON COLUMN reservation_status_history.new_status IS 'New status';
COMMENT ON COLUMN reservation_status_history.change_reason IS 'Brief reason for change';
COMMENT ON COLUMN reservation_status_history.changed_by IS 'User who made the change';
COMMENT ON COLUMN reservation_status_history.changed_at IS 'Timestamp of change';

\echo 'Reservation_status_history table created successfully!'
