-- =====================================================
-- 35_refunds_fk.sql
-- Foreign Key Constraints for refunds table
--
-- Relationships: tenant, property, reservation, guest, folio,
--                payment, posting, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_tenant;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_property;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_reservation;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_guest;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_folio;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_original_payment;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_original_posting;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_parent;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_created_by;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_updated_by;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_requested_by;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_approved_by;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_rejected_by;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_processing_started_by;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_processed_by;
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS fk_refunds_deleted_by;

-- Tenant reference (required)
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_refunds_tenant ON refunds IS 'Refunds belong to a tenant';

-- Property reference (required)
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_property
    FOREIGN KEY (property_id)
    REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_refunds_property ON refunds IS 'Refunds belong to a property';

-- Reservation reference (optional)
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_reservation
    FOREIGN KEY (reservation_id)
    REFERENCES reservations(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_refunds_reservation ON refunds IS 'Refund for reservation';

-- Guest reference (required)
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_guest
    FOREIGN KEY (guest_id)
    REFERENCES guests(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_refunds_guest ON refunds IS 'Guest receiving refund';

-- Folio reference (optional)
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_folio
    FOREIGN KEY (folio_id)
    REFERENCES folios(folio_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_refunds_folio ON refunds IS 'Folio this refund is posted to';

-- Original payment reference (optional)
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_original_payment
    FOREIGN KEY (original_payment_id)
    REFERENCES payments(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_refunds_original_payment ON refunds IS 'Original payment being refunded';

-- Original posting reference (optional)
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_original_posting
    FOREIGN KEY (original_posting_id)
    REFERENCES charge_postings(posting_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_refunds_original_posting ON refunds IS 'Original charge being reversed';

-- Parent refund (self-referential for split refunds)
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_parent
    FOREIGN KEY (parent_refund_id)
    REFERENCES refunds(refund_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_refunds_parent ON refunds IS 'Parent refund for partial refunds';

-- Created by user
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Updated by user
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Requested by user
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_requested_by
    FOREIGN KEY (requested_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_refunds_requested_by ON refunds IS 'User who initiated refund request';

-- Approved by user
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_approved_by
    FOREIGN KEY (approved_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_refunds_approved_by ON refunds IS 'Manager who approved refund';

-- Rejected by user
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_rejected_by
    FOREIGN KEY (rejected_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_refunds_rejected_by ON refunds IS 'User who rejected refund';

-- Processing started by user
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_processing_started_by
    FOREIGN KEY (processing_started_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_refunds_processing_started_by ON refunds IS 'User who started processing';

-- Processed by user
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_processed_by
    FOREIGN KEY (processed_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_refunds_processed_by ON refunds IS 'User who completed refund processing';

-- Deleted by user
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_deleted_by
    FOREIGN KEY (deleted_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Success message
\echo '✓ Constraints created: refunds (35/37)'
\echo '  - 16 foreign key constraints'
\echo '  - Complete refund workflow tracking'
\echo ''
