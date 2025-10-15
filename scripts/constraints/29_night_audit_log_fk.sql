-- =====================================================
-- 29_night_audit_log_fk.sql
-- Foreign Key Constraints for night_audit_log table
--
-- Relationships: tenant, property, business_date, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE night_audit_log DROP CONSTRAINT IF EXISTS fk_night_audit_log_tenant;
ALTER TABLE night_audit_log DROP CONSTRAINT IF EXISTS fk_night_audit_log_property;
ALTER TABLE night_audit_log DROP CONSTRAINT IF EXISTS fk_night_audit_log_business_date;
ALTER TABLE night_audit_log DROP CONSTRAINT IF EXISTS fk_night_audit_log_initiated_by;
ALTER TABLE night_audit_log DROP CONSTRAINT IF EXISTS fk_night_audit_log_completed_by;
ALTER TABLE night_audit_log DROP CONSTRAINT IF EXISTS fk_night_audit_log_acknowledged_by;
ALTER TABLE night_audit_log DROP CONSTRAINT IF EXISTS fk_night_audit_log_previous_attempt;
ALTER TABLE night_audit_log DROP CONSTRAINT IF EXISTS fk_night_audit_log_created_by;
ALTER TABLE night_audit_log DROP CONSTRAINT IF EXISTS fk_night_audit_log_updated_by;
ALTER TABLE night_audit_log DROP CONSTRAINT IF EXISTS fk_night_audit_log_deleted_by;

-- Tenant reference (required)
ALTER TABLE night_audit_log
    ADD CONSTRAINT fk_night_audit_log_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_night_audit_log_tenant ON night_audit_log IS 'Audit logs belong to a tenant';

-- Property reference (required)
ALTER TABLE night_audit_log
    ADD CONSTRAINT fk_night_audit_log_property
    FOREIGN KEY (property_id)
    REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_night_audit_log_property ON night_audit_log IS 'Audit logs belong to a property';

-- Business date reference (optional - for linking)
ALTER TABLE night_audit_log
    ADD CONSTRAINT fk_night_audit_log_business_date
    FOREIGN KEY (business_date_id)
    REFERENCES business_dates(business_date_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_night_audit_log_business_date ON night_audit_log IS 'Links to business date being audited';

-- Initiated by user (required)
ALTER TABLE night_audit_log
    ADD CONSTRAINT fk_night_audit_log_initiated_by
    FOREIGN KEY (initiated_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_night_audit_log_initiated_by ON night_audit_log IS 'User who started the audit';

-- Completed by user
ALTER TABLE night_audit_log
    ADD CONSTRAINT fk_night_audit_log_completed_by
    FOREIGN KEY (completed_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_night_audit_log_completed_by ON night_audit_log IS 'User who completed the audit';

-- Acknowledged by user
ALTER TABLE night_audit_log
    ADD CONSTRAINT fk_night_audit_log_acknowledged_by
    FOREIGN KEY (acknowledged_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_night_audit_log_acknowledged_by ON night_audit_log IS 'User who acknowledged errors/warnings';

-- Previous attempt (self-referential for retries)
ALTER TABLE night_audit_log
    ADD CONSTRAINT fk_night_audit_log_previous_attempt
    FOREIGN KEY (previous_attempt_id)
    REFERENCES night_audit_log(audit_log_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_night_audit_log_previous_attempt ON night_audit_log IS 'Links to previous failed attempt';

-- Created by user
ALTER TABLE night_audit_log
    ADD CONSTRAINT fk_night_audit_log_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Updated by user
ALTER TABLE night_audit_log
    ADD CONSTRAINT fk_night_audit_log_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Deleted by user
ALTER TABLE night_audit_log
    ADD CONSTRAINT fk_night_audit_log_deleted_by
    FOREIGN KEY (deleted_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Success message
\echo '✓ Constraints created: night_audit_log (29/37)'
\echo '  - 10 foreign key constraints'
\echo '  - Complete EOD process tracking'
\echo ''
