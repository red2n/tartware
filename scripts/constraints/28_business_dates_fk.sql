-- =====================================================
-- 28_business_dates_fk.sql
-- Foreign Key Constraints for business_dates table
--
-- Relationships: tenant, property, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE business_dates DROP CONSTRAINT IF EXISTS fk_business_dates_tenant;
ALTER TABLE business_dates DROP CONSTRAINT IF EXISTS fk_business_dates_property;
ALTER TABLE business_dates DROP CONSTRAINT IF EXISTS fk_business_dates_created_by;
ALTER TABLE business_dates DROP CONSTRAINT IF EXISTS fk_business_dates_updated_by;
ALTER TABLE business_dates DROP CONSTRAINT IF EXISTS fk_business_dates_opened_by;
ALTER TABLE business_dates DROP CONSTRAINT IF EXISTS fk_business_dates_closed_by;
ALTER TABLE business_dates DROP CONSTRAINT IF EXISTS fk_business_dates_rolled_by;
ALTER TABLE business_dates DROP CONSTRAINT IF EXISTS fk_business_dates_locked_by;
ALTER TABLE business_dates DROP CONSTRAINT IF EXISTS fk_business_dates_reconciled_by;
ALTER TABLE business_dates DROP CONSTRAINT IF EXISTS fk_business_dates_audit_started_by;
ALTER TABLE business_dates DROP CONSTRAINT IF EXISTS fk_business_dates_audit_completed_by;
ALTER TABLE business_dates DROP CONSTRAINT IF EXISTS fk_business_dates_deleted_by;

-- Tenant reference (required)
ALTER TABLE business_dates
    ADD CONSTRAINT fk_business_dates_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_business_dates_tenant ON business_dates IS 'Business dates belong to a tenant';

-- Property reference (required - each property has its own business date)
ALTER TABLE business_dates
    ADD CONSTRAINT fk_business_dates_property
    FOREIGN KEY (property_id)
    REFERENCES properties(property_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_business_dates_property ON business_dates IS 'Each property manages its own business date';

-- Created by user
ALTER TABLE business_dates
    ADD CONSTRAINT fk_business_dates_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Updated by user
ALTER TABLE business_dates
    ADD CONSTRAINT fk_business_dates_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Opened by user
ALTER TABLE business_dates
    ADD CONSTRAINT fk_business_dates_opened_by
    FOREIGN KEY (date_opened_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_business_dates_opened_by ON business_dates IS 'User who opened this business date';

-- Closed by user
ALTER TABLE business_dates
    ADD CONSTRAINT fk_business_dates_closed_by
    FOREIGN KEY (date_closed_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_business_dates_closed_by ON business_dates IS 'User who closed this business date';

-- Rolled by user (date advanced)
ALTER TABLE business_dates
    ADD CONSTRAINT fk_business_dates_rolled_by
    FOREIGN KEY (date_rolled_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_business_dates_rolled_by ON business_dates IS 'User who advanced the business date';

-- Locked by user
ALTER TABLE business_dates
    ADD CONSTRAINT fk_business_dates_locked_by
    FOREIGN KEY (locked_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_business_dates_locked_by ON business_dates IS 'User who locked the date (during audit)';

-- Reconciled by user
ALTER TABLE business_dates
    ADD CONSTRAINT fk_business_dates_reconciled_by
    FOREIGN KEY (reconciled_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_business_dates_reconciled_by ON business_dates IS 'User who reconciled this date';

-- Night audit started by user
ALTER TABLE business_dates
    ADD CONSTRAINT fk_business_dates_audit_started_by
    FOREIGN KEY (night_audit_started_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_business_dates_audit_started_by ON business_dates IS 'User who started night audit';

-- Night audit completed by user
ALTER TABLE business_dates
    ADD CONSTRAINT fk_business_dates_audit_completed_by
    FOREIGN KEY (night_audit_completed_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_business_dates_audit_completed_by ON business_dates IS 'User who completed night audit';

-- Deleted by user
ALTER TABLE business_dates
    ADD CONSTRAINT fk_business_dates_deleted_by
    FOREIGN KEY (deleted_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Success message
\echo '✓ Constraints created: business_dates (28/37)'
\echo '  - 12 foreign key constraints'
\echo '  - Complete audit trail for date management'
\echo ''
