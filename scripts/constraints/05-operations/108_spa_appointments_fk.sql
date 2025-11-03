-- =====================================================
-- Foreign keys for spa_appointments table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for spa_appointments...'

-- Tenant scope
ALTER TABLE spa_appointments
    ADD CONSTRAINT fk_spa_appointments_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Property scope
ALTER TABLE spa_appointments
    ADD CONSTRAINT fk_spa_appointments_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Treatment association
ALTER TABLE spa_appointments
    ADD CONSTRAINT fk_spa_appointments_treatment
    FOREIGN KEY (treatment_id) REFERENCES spa_treatments(treatment_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Guest and reservation references
ALTER TABLE spa_appointments
    ADD CONSTRAINT fk_spa_appointments_guest
    FOREIGN KEY (guest_id) REFERENCES guests(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE spa_appointments
    ADD CONSTRAINT fk_spa_appointments_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE spa_appointments
    ADD CONSTRAINT fk_spa_appointments_folio
    FOREIGN KEY (folio_id) REFERENCES folios(folio_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Staff assignments
ALTER TABLE spa_appointments
    ADD CONSTRAINT fk_spa_appointments_primary_therapist
    FOREIGN KEY (primary_therapist_id) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE spa_appointments
    ADD CONSTRAINT fk_spa_appointments_secondary_therapist
    FOREIGN KEY (secondary_therapist_id) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Treatment room
ALTER TABLE spa_appointments
    ADD CONSTRAINT fk_spa_appointments_room
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Cancellation metadata
ALTER TABLE spa_appointments
    ADD CONSTRAINT fk_spa_appointments_cancelled_by
    FOREIGN KEY (cancelled_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Audit columns
ALTER TABLE spa_appointments
    ADD CONSTRAINT fk_spa_appointments_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE spa_appointments
    ADD CONSTRAINT fk_spa_appointments_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE spa_appointments
    ADD CONSTRAINT fk_spa_appointments_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

\echo 'Foreign keys for spa_appointments created successfully!'
