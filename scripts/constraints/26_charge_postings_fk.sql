-- =====================================================
-- 26_charge_postings_fk.sql
-- Foreign Key Constraints for charge_postings table
--
-- Relationships: tenant, property, folio, reservation, guest, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE charge_postings DROP CONSTRAINT IF EXISTS fk_charge_postings_tenant;
ALTER TABLE charge_postings DROP CONSTRAINT IF EXISTS fk_charge_postings_property;
ALTER TABLE charge_postings DROP CONSTRAINT IF EXISTS fk_charge_postings_folio;
ALTER TABLE charge_postings DROP CONSTRAINT IF EXISTS fk_charge_postings_reservation;
ALTER TABLE charge_postings DROP CONSTRAINT IF EXISTS fk_charge_postings_guest;
ALTER TABLE charge_postings DROP CONSTRAINT IF EXISTS fk_charge_postings_original_posting;
ALTER TABLE charge_postings DROP CONSTRAINT IF EXISTS fk_charge_postings_void_posting;
ALTER TABLE charge_postings DROP CONSTRAINT IF EXISTS fk_charge_postings_transfer_from;
ALTER TABLE charge_postings DROP CONSTRAINT IF EXISTS fk_charge_postings_transfer_to;
ALTER TABLE charge_postings DROP CONSTRAINT IF EXISTS fk_charge_postings_created_by;
ALTER TABLE charge_postings DROP CONSTRAINT IF EXISTS fk_charge_postings_updated_by;
ALTER TABLE charge_postings DROP CONSTRAINT IF EXISTS fk_charge_postings_voided_by;
ALTER TABLE charge_postings DROP CONSTRAINT IF EXISTS fk_charge_postings_deleted_by;

-- Tenant reference (required)
ALTER TABLE charge_postings
    ADD CONSTRAINT fk_charge_postings_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_charge_postings_tenant ON charge_postings IS 'Charge postings belong to a tenant';

-- Property reference (required)
ALTER TABLE charge_postings
    ADD CONSTRAINT fk_charge_postings_property
    FOREIGN KEY (property_id)
    REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_charge_postings_property ON charge_postings IS 'Charge postings belong to a property';

-- Folio reference (required - every charge is posted to a folio)
ALTER TABLE charge_postings
    ADD CONSTRAINT fk_charge_postings_folio
    FOREIGN KEY (folio_id)
    REFERENCES folios(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_charge_postings_folio ON charge_postings IS 'Every charge is posted to a folio';

-- Reservation reference (optional)
ALTER TABLE charge_postings
    ADD CONSTRAINT fk_charge_postings_reservation
    FOREIGN KEY (reservation_id)
    REFERENCES reservations(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_charge_postings_reservation ON charge_postings IS 'Charge may be associated with reservation';

-- Guest reference (optional)
ALTER TABLE charge_postings
    ADD CONSTRAINT fk_charge_postings_guest
    FOREIGN KEY (guest_id)
    REFERENCES guests(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_charge_postings_guest ON charge_postings IS 'Charge may be associated with guest';

-- Void relationships (self-referential)
ALTER TABLE charge_postings
    ADD CONSTRAINT fk_charge_postings_original_posting
    FOREIGN KEY (original_posting_id)
    REFERENCES charge_postings(posting_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_charge_postings_original_posting ON charge_postings IS 'Original posting being voided';

ALTER TABLE charge_postings
    ADD CONSTRAINT fk_charge_postings_void_posting
    FOREIGN KEY (void_posting_id)
    REFERENCES charge_postings(posting_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_charge_postings_void_posting ON charge_postings IS 'Void transaction that reverses this posting';

-- Transfer relationships (self-referential via folios)
ALTER TABLE charge_postings
    ADD CONSTRAINT fk_charge_postings_transfer_from
    FOREIGN KEY (transfer_from_folio_id)
    REFERENCES folios(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_charge_postings_transfer_from ON charge_postings IS 'Source folio for transfer';

ALTER TABLE charge_postings
    ADD CONSTRAINT fk_charge_postings_transfer_to
    FOREIGN KEY (transfer_to_folio_id)
    REFERENCES folios(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_charge_postings_transfer_to ON charge_postings IS 'Destination folio for transfer';

-- Created by user
ALTER TABLE charge_postings
    ADD CONSTRAINT fk_charge_postings_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Updated by user
ALTER TABLE charge_postings
    ADD CONSTRAINT fk_charge_postings_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Voided by user
ALTER TABLE charge_postings
    ADD CONSTRAINT fk_charge_postings_voided_by
    FOREIGN KEY (voided_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_charge_postings_voided_by ON charge_postings IS 'User who voided this transaction';

-- Deleted by user
ALTER TABLE charge_postings
    ADD CONSTRAINT fk_charge_postings_deleted_by
    FOREIGN KEY (deleted_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Success message
\echo '✓ Constraints created: charge_postings (26/37)'
\echo '  - 13 foreign key constraints'
\echo '  - Complete transaction tracking'
\echo ''
