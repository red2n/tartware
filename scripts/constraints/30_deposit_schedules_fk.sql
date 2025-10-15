-- =====================================================
-- 30_deposit_schedules_fk.sql
-- Foreign Key Constraints for deposit_schedules table
--
-- Relationships: tenant, property, reservation, guest, folio, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE deposit_schedules DROP CONSTRAINT IF EXISTS fk_deposit_schedules_tenant;
ALTER TABLE deposit_schedules DROP CONSTRAINT IF EXISTS fk_deposit_schedules_property;
ALTER TABLE deposit_schedules DROP CONSTRAINT IF EXISTS fk_deposit_schedules_reservation;
ALTER TABLE deposit_schedules DROP CONSTRAINT IF EXISTS fk_deposit_schedules_guest;
ALTER TABLE deposit_schedules DROP CONSTRAINT IF EXISTS fk_deposit_schedules_folio;
ALTER TABLE deposit_schedules DROP CONSTRAINT IF EXISTS fk_deposit_schedules_parent;
ALTER TABLE deposit_schedules DROP CONSTRAINT IF EXISTS fk_deposit_schedules_posting;
ALTER TABLE deposit_schedules DROP CONSTRAINT IF EXISTS fk_deposit_schedules_created_by;
ALTER TABLE deposit_schedules DROP CONSTRAINT IF EXISTS fk_deposit_schedules_updated_by;
ALTER TABLE deposit_schedules DROP CONSTRAINT IF EXISTS fk_deposit_schedules_paid_by;
ALTER TABLE deposit_schedules DROP CONSTRAINT IF EXISTS fk_deposit_schedules_waived_by;
ALTER TABLE deposit_schedules DROP CONSTRAINT IF EXISTS fk_deposit_schedules_waiver_approved_by;
ALTER TABLE deposit_schedules DROP CONSTRAINT IF EXISTS fk_deposit_schedules_posted_by;
ALTER TABLE deposit_schedules DROP CONSTRAINT IF EXISTS fk_deposit_schedules_deleted_by;

-- Tenant reference (required)
ALTER TABLE deposit_schedules
    ADD CONSTRAINT fk_deposit_schedules_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_deposit_schedules_tenant ON deposit_schedules IS 'Deposit schedules belong to a tenant';

-- Property reference (required)
ALTER TABLE deposit_schedules
    ADD CONSTRAINT fk_deposit_schedules_property
    FOREIGN KEY (property_id)
    REFERENCES properties(property_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_deposit_schedules_property ON deposit_schedules IS 'Deposit schedules belong to a property';

-- Reservation reference (required)
ALTER TABLE deposit_schedules
    ADD CONSTRAINT fk_deposit_schedules_reservation
    FOREIGN KEY (reservation_id)
    REFERENCES reservations(reservation_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_deposit_schedules_reservation ON deposit_schedules IS 'Deposit schedule for reservation';

-- Guest reference (optional)
ALTER TABLE deposit_schedules
    ADD CONSTRAINT fk_deposit_schedules_guest
    FOREIGN KEY (guest_id)
    REFERENCES guests(guest_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_deposit_schedules_guest ON deposit_schedules IS 'Guest responsible for payment';

-- Folio reference (optional)
ALTER TABLE deposit_schedules
    ADD CONSTRAINT fk_deposit_schedules_folio
    FOREIGN KEY (folio_id)
    REFERENCES folios(folio_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_deposit_schedules_folio ON deposit_schedules IS 'Folio to post payment to';

-- Parent schedule (self-referential for installments)
ALTER TABLE deposit_schedules
    ADD CONSTRAINT fk_deposit_schedules_parent
    FOREIGN KEY (parent_schedule_id)
    REFERENCES deposit_schedules(schedule_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_deposit_schedules_parent ON deposit_schedules IS 'Parent schedule for installment plans';

-- Posting reference
ALTER TABLE deposit_schedules
    ADD CONSTRAINT fk_deposit_schedules_posting
    FOREIGN KEY (posting_id)
    REFERENCES charge_postings(posting_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_deposit_schedules_posting ON deposit_schedules IS 'Charge posting for this deposit';

-- Created by user
ALTER TABLE deposit_schedules
    ADD CONSTRAINT fk_deposit_schedules_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Updated by user
ALTER TABLE deposit_schedules
    ADD CONSTRAINT fk_deposit_schedules_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Paid by user
ALTER TABLE deposit_schedules
    ADD CONSTRAINT fk_deposit_schedules_paid_by
    FOREIGN KEY (paid_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_deposit_schedules_paid_by ON deposit_schedules IS 'User who recorded the payment';

-- Waived by user
ALTER TABLE deposit_schedules
    ADD CONSTRAINT fk_deposit_schedules_waived_by
    FOREIGN KEY (waived_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_deposit_schedules_waived_by ON deposit_schedules IS 'User who waived the deposit';

-- Waiver approved by user
ALTER TABLE deposit_schedules
    ADD CONSTRAINT fk_deposit_schedules_waiver_approved_by
    FOREIGN KEY (waiver_approved_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_deposit_schedules_waiver_approved_by ON deposit_schedules IS 'Manager who approved waiver';

-- Posted by user
ALTER TABLE deposit_schedules
    ADD CONSTRAINT fk_deposit_schedules_posted_by
    FOREIGN KEY (posted_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_deposit_schedules_posted_by ON deposit_schedules IS 'User who posted to folio';

-- Deleted by user
ALTER TABLE deposit_schedules
    ADD CONSTRAINT fk_deposit_schedules_deleted_by
    FOREIGN KEY (deleted_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Success message
\echo '✓ Constraints created: deposit_schedules (30/37)'
\echo '  - 14 foreign key constraints'
\echo '  - Complete payment schedule tracking'
\echo ''
\echo '==================================='
\echo '✓ PHASE 1 CONSTRAINTS COMPLETE (6/13)'
\echo '==================================='
\echo ''
