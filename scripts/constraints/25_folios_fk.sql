-- =====================================================
-- 25_folios_fk.sql
-- Foreign Key Constraints for folios table
--
-- Relationships: tenant, property, reservation, guest, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE folios DROP CONSTRAINT IF EXISTS fk_folios_tenant;
ALTER TABLE folios DROP CONSTRAINT IF EXISTS fk_folios_property;
ALTER TABLE folios DROP CONSTRAINT IF EXISTS fk_folios_reservation;
ALTER TABLE folios DROP CONSTRAINT IF EXISTS fk_folios_guest;
ALTER TABLE folios DROP CONSTRAINT IF EXISTS fk_folios_transferred_from;
ALTER TABLE folios DROP CONSTRAINT IF EXISTS fk_folios_transferred_to;
ALTER TABLE folios DROP CONSTRAINT IF EXISTS fk_folios_created_by;
ALTER TABLE folios DROP CONSTRAINT IF EXISTS fk_folios_updated_by;
ALTER TABLE folios DROP CONSTRAINT IF EXISTS fk_folios_settled_by;
ALTER TABLE folios DROP CONSTRAINT IF EXISTS fk_folios_deleted_by;

-- Tenant reference (required)
ALTER TABLE folios
    ADD CONSTRAINT fk_folios_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_folios_tenant ON folios IS 'Folios belong to a tenant';

-- Property reference (required)
ALTER TABLE folios
    ADD CONSTRAINT fk_folios_property
    FOREIGN KEY (property_id)
    REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_folios_property ON folios IS 'Folios belong to a property';

-- Reservation reference (optional - may be walk-in or city ledger)
ALTER TABLE folios
    ADD CONSTRAINT fk_folios_reservation
    FOREIGN KEY (reservation_id)
    REFERENCES reservations(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_folios_reservation ON folios IS 'Folio associated with reservation';

-- Guest reference (optional)
ALTER TABLE folios
    ADD CONSTRAINT fk_folios_guest
    FOREIGN KEY (guest_id)
    REFERENCES guests(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_folios_guest ON folios IS 'Folio belongs to guest';

-- Transfer relationships (self-referential)
ALTER TABLE folios
    ADD CONSTRAINT fk_folios_transferred_from
    FOREIGN KEY (transferred_from_folio_id)
    REFERENCES folios(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_folios_transferred_from ON folios IS 'Source folio for balance transfer';

ALTER TABLE folios
    ADD CONSTRAINT fk_folios_transferred_to
    FOREIGN KEY (transferred_to_folio_id)
    REFERENCES folios(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_folios_transferred_to ON folios IS 'Destination folio for balance transfer';

-- Created by user
ALTER TABLE folios
    ADD CONSTRAINT fk_folios_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Updated by user
ALTER TABLE folios
    ADD CONSTRAINT fk_folios_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Settled by user
ALTER TABLE folios
    ADD CONSTRAINT fk_folios_settled_by
    FOREIGN KEY (settled_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_folios_settled_by ON folios IS 'User who settled the folio';

-- Deleted by user
ALTER TABLE folios
    ADD CONSTRAINT fk_folios_deleted_by
    FOREIGN KEY (deleted_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Success message
\echo '✓ Constraints created: folios (25/37)'
\echo '  - 10 foreign key constraints'
\echo '  - Multi-tenant relationships'
\echo ''
