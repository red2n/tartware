-- =====================================================
-- Procedure: track_reservation_status_change
-- Purpose: Trigger function that auto-records status
--          transitions in reservation_status_history
--          whenever a reservation status changes.
-- Domain: Bookings / Reservations
-- =====================================================

CREATE OR REPLACE FUNCTION track_reservation_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO reservation_status_history (
            reservation_id, tenant_id,
            previous_status, new_status,
            change_reason, changed_by, changed_at
        ) VALUES (
            NEW.id, NEW.tenant_id,
            OLD.status, NEW.status,
            COALESCE(NEW.cancellation_reason, NULL),
            COALESCE(NEW.updated_by, 'system'),
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION track_reservation_status_change IS
'Trigger function: auto-records reservation status transitions in reservation_status_history';

-- Trigger definition
DROP TRIGGER IF EXISTS trg_reservation_status_history ON reservations;
CREATE TRIGGER trg_reservation_status_history
    AFTER UPDATE OF status ON reservations
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION track_reservation_status_change();

\echo '✓ Reservation status history trigger created.'
