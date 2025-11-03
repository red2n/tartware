-- =====================================================
-- Foreign keys for waitlist_entries table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for waitlist_entries...'

-- Tenant scope
ALTER TABLE waitlist_entries
    ADD CONSTRAINT fk_waitlist_entries_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Property scope
ALTER TABLE waitlist_entries
    ADD CONSTRAINT fk_waitlist_entries_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Linked reservation (optional)
ALTER TABLE waitlist_entries
    ADD CONSTRAINT fk_waitlist_entries_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Linked guest (optional)
ALTER TABLE waitlist_entries
    ADD CONSTRAINT fk_waitlist_entries_guest
    FOREIGN KEY (guest_id) REFERENCES guests(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Requested inventory references
ALTER TABLE waitlist_entries
    ADD CONSTRAINT fk_waitlist_entries_room_type
    FOREIGN KEY (requested_room_type_id) REFERENCES room_types(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE waitlist_entries
    ADD CONSTRAINT fk_waitlist_entries_rate
    FOREIGN KEY (requested_rate_id) REFERENCES rates(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Audit columns
ALTER TABLE waitlist_entries
    ADD CONSTRAINT fk_waitlist_entries_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE waitlist_entries
    ADD CONSTRAINT fk_waitlist_entries_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE waitlist_entries
    ADD CONSTRAINT fk_waitlist_entries_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

\echo 'Foreign keys for waitlist_entries created successfully!'
