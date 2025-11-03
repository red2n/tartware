-- =====================================================
-- Foreign keys for reservation_traces table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for reservation_traces...'

-- Tenant scope
ALTER TABLE reservation_traces
    ADD CONSTRAINT fk_reservation_traces_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Property scope
ALTER TABLE reservation_traces
    ADD CONSTRAINT fk_reservation_traces_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Reservation link (required)
ALTER TABLE reservation_traces
    ADD CONSTRAINT fk_reservation_traces_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Guest link (optional)
ALTER TABLE reservation_traces
    ADD CONSTRAINT fk_reservation_traces_guest
    FOREIGN KEY (guest_id) REFERENCES guests(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Assignment to front-desk user
ALTER TABLE reservation_traces
    ADD CONSTRAINT fk_reservation_traces_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Completion metadata
ALTER TABLE reservation_traces
    ADD CONSTRAINT fk_reservation_traces_completed_by
    FOREIGN KEY (completed_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Audit columns
ALTER TABLE reservation_traces
    ADD CONSTRAINT fk_reservation_traces_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE reservation_traces
    ADD CONSTRAINT fk_reservation_traces_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE reservation_traces
    ADD CONSTRAINT fk_reservation_traces_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

\echo 'Foreign keys for reservation_traces created successfully!'
