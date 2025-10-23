-- =====================================================
-- 27_audit_logs_fk.sql
-- Foreign Key Constraints for audit_logs table
--
-- Relationships: tenant, property, user
-- Note: Audit logs have minimal FKs to prevent deletion issues
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS fk_audit_logs_tenant;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS fk_audit_logs_property;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS fk_audit_logs_user;

-- Tenant reference (required)
ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_logs_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_audit_logs_tenant ON audit_logs IS 'Audit logs belong to a tenant';

-- Property reference (optional - may be tenant-level actions)
ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_logs_property
    FOREIGN KEY (property_id)
    REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_audit_logs_property ON audit_logs IS 'Audit logs may be property-specific';

-- User reference (required - who performed the action)
-- Note: SET NULL to preserve audit trail if user is deleted
ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_audit_logs_user ON audit_logs IS 'User who performed the audited action';

-- Note: entity_id is NOT constrained as it can reference any table
-- This allows audit logs to persist even if referenced entity is deleted

-- Success message
\echo '✓ Constraints created: audit_logs (27/37)'
\echo '  - 3 foreign key constraints'
\echo '  - Minimal FKs for audit trail preservation'
\echo ''
