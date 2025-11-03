-- =====================================================
-- Foreign keys for general_ledger_batches table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for general_ledger_batches...'

-- Tenant scope
ALTER TABLE general_ledger_batches
    ADD CONSTRAINT fk_gl_batches_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Property scope
ALTER TABLE general_ledger_batches
    ADD CONSTRAINT fk_gl_batches_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Export metadata
ALTER TABLE general_ledger_batches
    ADD CONSTRAINT fk_gl_batches_exported_by
    FOREIGN KEY (exported_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Audit columns
ALTER TABLE general_ledger_batches
    ADD CONSTRAINT fk_gl_batches_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE general_ledger_batches
    ADD CONSTRAINT fk_gl_batches_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE general_ledger_batches
    ADD CONSTRAINT fk_gl_batches_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

\echo 'Foreign keys for general_ledger_batches created successfully!'
