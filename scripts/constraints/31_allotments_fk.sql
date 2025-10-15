-- =====================================================
-- 31_allotments_fk.sql
-- Foreign Key Constraints for allotments table
--
-- Relationships: tenant, property, room_type, booking_source,
--                market_segment, folio, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE allotments DROP CONSTRAINT IF EXISTS fk_allotments_tenant;
ALTER TABLE allotments DROP CONSTRAINT IF EXISTS fk_allotments_property;
ALTER TABLE allotments DROP CONSTRAINT IF EXISTS fk_allotments_room_type;
ALTER TABLE allotments DROP CONSTRAINT IF EXISTS fk_allotments_booking_source;
ALTER TABLE allotments DROP CONSTRAINT IF EXISTS fk_allotments_market_segment;
ALTER TABLE allotments DROP CONSTRAINT IF EXISTS fk_allotments_master_folio;
ALTER TABLE allotments DROP CONSTRAINT IF EXISTS fk_allotments_account_manager;
ALTER TABLE allotments DROP CONSTRAINT IF EXISTS fk_allotments_operations_manager;
ALTER TABLE allotments DROP CONSTRAINT IF EXISTS fk_allotments_created_by;
ALTER TABLE allotments DROP CONSTRAINT IF EXISTS fk_allotments_updated_by;
ALTER TABLE allotments DROP CONSTRAINT IF EXISTS fk_allotments_confirmed_by;
ALTER TABLE allotments DROP CONSTRAINT IF EXISTS fk_allotments_cancelled_by;
ALTER TABLE allotments DROP CONSTRAINT IF EXISTS fk_allotments_deleted_by;

-- Tenant reference (required)
ALTER TABLE allotments
    ADD CONSTRAINT fk_allotments_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_allotments_tenant ON allotments IS 'Allotments belong to a tenant';

-- Property reference (required)
ALTER TABLE allotments
    ADD CONSTRAINT fk_allotments_property
    FOREIGN KEY (property_id)
    REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_allotments_property ON allotments IS 'Allotments belong to a property';

-- Room type reference (optional - may be multi-type)
ALTER TABLE allotments
    ADD CONSTRAINT fk_allotments_room_type
    FOREIGN KEY (room_type_id)
    REFERENCES room_types(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_allotments_room_type ON allotments IS 'Room type for this block';

-- Booking source reference (optional)
ALTER TABLE allotments
    ADD CONSTRAINT fk_allotments_booking_source
    FOREIGN KEY (booking_source_id)
    REFERENCES booking_sources(source_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_allotments_booking_source ON allotments IS 'Source channel for this allotment';

-- Market segment reference (optional)
ALTER TABLE allotments
    ADD CONSTRAINT fk_allotments_market_segment
    FOREIGN KEY (market_segment_id)
    REFERENCES market_segments(segment_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_allotments_market_segment ON allotments IS 'Market segment for this allotment';

-- Master folio reference (optional)
ALTER TABLE allotments
    ADD CONSTRAINT fk_allotments_master_folio
    FOREIGN KEY (master_folio_id)
    REFERENCES folios(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_allotments_master_folio ON allotments IS 'Master billing folio for group';

-- Account manager reference (optional)
ALTER TABLE allotments
    ADD CONSTRAINT fk_allotments_account_manager
    FOREIGN KEY (account_manager_id)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_allotments_account_manager ON allotments IS 'Sales person responsible';

-- Operations manager reference (optional)
ALTER TABLE allotments
    ADD CONSTRAINT fk_allotments_operations_manager
    FOREIGN KEY (operations_manager_id)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_allotments_operations_manager ON allotments IS 'Operations manager responsible';

-- Created by user
ALTER TABLE allotments
    ADD CONSTRAINT fk_allotments_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Updated by user
ALTER TABLE allotments
    ADD CONSTRAINT fk_allotments_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Confirmed by user
ALTER TABLE allotments
    ADD CONSTRAINT fk_allotments_confirmed_by
    FOREIGN KEY (confirmed_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_allotments_confirmed_by ON allotments IS 'User who confirmed the allotment';

-- Cancelled by user
ALTER TABLE allotments
    ADD CONSTRAINT fk_allotments_cancelled_by
    FOREIGN KEY (cancelled_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_allotments_cancelled_by ON allotments IS 'User who cancelled the allotment';

-- Deleted by user
ALTER TABLE allotments
    ADD CONSTRAINT fk_allotments_deleted_by
    FOREIGN KEY (deleted_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Success message
\echo '✓ Constraints created: allotments (31/37)'
\echo '  - 13 foreign key constraints'
\echo '  - Group booking relationships'
\echo ''
