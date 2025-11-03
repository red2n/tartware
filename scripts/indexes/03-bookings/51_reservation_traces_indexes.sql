-- =====================================================
-- 51_reservation_traces_indexes.sql
-- Indexes for Reservation Traces
-- Date: 2025-11-03
-- =====================================================

\c tartware

\echo 'Creating reservation_traces indexes...'

CREATE INDEX idx_reservation_traces_tenant
    ON reservation_traces(tenant_id)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_reservation_traces_property
    ON reservation_traces(property_id)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_reservation_traces_reservation_status
    ON reservation_traces(reservation_id, status)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_reservation_traces_assigned_due
    ON reservation_traces(assigned_to, status, due_date)
    WHERE assigned_to IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_reservation_traces_due_date
    ON reservation_traces(due_date, trace_type)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_reservation_traces_trace_type
    ON reservation_traces(trace_type)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_reservation_traces_alert_channels
    ON reservation_traces USING gin(alert_channels)
    WHERE alert_channels IS NOT NULL;

CREATE INDEX idx_reservation_traces_alert_trigger
    ON reservation_traces(alert_trigger)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_reservation_traces_guest
    ON reservation_traces(guest_id, status)
    WHERE guest_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_reservation_traces_created_by
    ON reservation_traces(created_by)
    WHERE created_by IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_reservation_traces_completion
    ON reservation_traces(status, completed_at)
    WHERE status IN ('COMPLETED', 'CANCELLED') AND is_deleted = FALSE;

\echo 'reservation_traces indexes created.'
