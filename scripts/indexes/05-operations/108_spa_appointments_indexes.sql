-- =====================================================
-- 108_spa_appointments_indexes.sql
-- Indexes for Spa Appointments
-- Date: 2025-11-03
-- =====================================================

\c tartware

\echo 'Creating spa_appointments indexes...'

CREATE INDEX idx_spa_appointments_tenant_date
    ON spa_appointments(tenant_id, property_id, appointment_date)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_spa_appointments_treatment_start
    ON spa_appointments(treatment_id, appointment_date, start_time)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_spa_appointments_guest
    ON spa_appointments(guest_id, appointment_date)
    WHERE guest_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_spa_appointments_reservation
    ON spa_appointments(reservation_id)
    WHERE reservation_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_spa_appointments_status
    ON spa_appointments(status, appointment_date, start_time)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_spa_appointments_therapist
    ON spa_appointments(primary_therapist_id, appointment_date)
    WHERE primary_therapist_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_spa_appointments_room
    ON spa_appointments(room_id, appointment_date)
    WHERE room_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_spa_appointments_payment_status
    ON spa_appointments(payment_status, total_amount)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_spa_appointments_required_resources
    ON spa_appointments USING gin(required_resources)
    WHERE required_resources IS NOT NULL AND required_resources <> '[]'::jsonb AND is_deleted = FALSE;

CREATE INDEX idx_spa_appointments_metadata
    ON spa_appointments USING gin(metadata)
    WHERE metadata IS NOT NULL AND metadata <> '{}'::jsonb AND is_deleted = FALSE;

\echo 'spa_appointments indexes created.'
