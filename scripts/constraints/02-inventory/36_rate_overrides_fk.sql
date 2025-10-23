-- =====================================================
-- 36_rate_overrides_fk.sql
-- Foreign Key Constraints for rate_overrides table
--
-- Relationships: tenant, property, reservation, room_type,
--                rate_plan, guest, booking_source, market_segment, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_tenant;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_property;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_reservation;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_room_type;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_rate_plan;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_guest;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_booking_source;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_market_segment;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_created_by;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_updated_by;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_requested_by;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_approved_by;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_rejected_by;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_applied_by;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_reviewed_by;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_verified_by;
ALTER TABLE rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_deleted_by;

-- Tenant reference (required)
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rate_overrides_tenant ON rate_overrides IS 'Rate overrides belong to a tenant';

-- Property reference (required)
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_property
    FOREIGN KEY (property_id)
    REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rate_overrides_property ON rate_overrides IS 'Rate overrides belong to a property';

-- Reservation reference (required)
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_reservation
    FOREIGN KEY (reservation_id)
    REFERENCES reservations(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rate_overrides_reservation ON rate_overrides IS 'Rate override for reservation';

-- Room type reference (optional)
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_room_type
    FOREIGN KEY (room_type_id)
    REFERENCES room_types(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rate_overrides_room_type ON rate_overrides IS 'Room type being overridden';

-- Rate plan reference (optional)
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_rate_plan
    FOREIGN KEY (rate_plan_id)
    REFERENCES rates(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rate_overrides_rate_plan ON rate_overrides IS 'Original rate plan';

-- Guest reference (optional)
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_guest
    FOREIGN KEY (guest_id)
    REFERENCES guests(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rate_overrides_guest ON rate_overrides IS 'Guest receiving rate override';

-- Booking source reference (optional)
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_booking_source
    FOREIGN KEY (booking_source_id)
    REFERENCES booking_sources(source_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rate_overrides_booking_source ON rate_overrides IS 'Booking channel for this override';

-- Market segment reference (optional)
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_market_segment
    FOREIGN KEY (market_segment_id)
    REFERENCES market_segments(segment_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rate_overrides_market_segment ON rate_overrides IS 'Market segment for this override';

-- Created by user
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Updated by user
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Requested by user
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_requested_by
    FOREIGN KEY (requested_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rate_overrides_requested_by ON rate_overrides IS 'User who requested override';

-- Approved by user
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_approved_by
    FOREIGN KEY (approved_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rate_overrides_approved_by ON rate_overrides IS 'Manager who approved override';

-- Rejected by user
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_rejected_by
    FOREIGN KEY (rejected_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rate_overrides_rejected_by ON rate_overrides IS 'User who rejected override';

-- Applied by user
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_applied_by
    FOREIGN KEY (applied_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rate_overrides_applied_by ON rate_overrides IS 'User who applied override to reservation';

-- Reviewed by user
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_reviewed_by
    FOREIGN KEY (reviewed_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rate_overrides_reviewed_by ON rate_overrides IS 'User who reviewed override';

-- Verified by user (for price matching)
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_verified_by
    FOREIGN KEY (verified_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_rate_overrides_verified_by ON rate_overrides IS 'User who verified competitor price';

-- Deleted by user
ALTER TABLE rate_overrides
    ADD CONSTRAINT fk_rate_overrides_deleted_by
    FOREIGN KEY (deleted_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Success message
\echo '✓ Constraints created: rate_overrides (36/37)'
\echo '  - 17 foreign key constraints'
\echo '  - Complete rate management workflow'
\echo ''
