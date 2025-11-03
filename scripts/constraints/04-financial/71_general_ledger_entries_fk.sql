-- =====================================================
-- Foreign keys for general_ledger_entries table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for general_ledger_entries...'

-- Parent batch
ALTER TABLE general_ledger_entries
    ADD CONSTRAINT fk_gl_entries_batch
    FOREIGN KEY (gl_batch_id) REFERENCES general_ledger_batches(gl_batch_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Tenant scope
ALTER TABLE general_ledger_entries
    ADD CONSTRAINT fk_gl_entries_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Property scope
ALTER TABLE general_ledger_entries
    ADD CONSTRAINT fk_gl_entries_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Optional folio linkage
ALTER TABLE general_ledger_entries
    ADD CONSTRAINT fk_gl_entries_folio
    FOREIGN KEY (folio_id) REFERENCES folios(folio_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Optional reservation linkage
ALTER TABLE general_ledger_entries
    ADD CONSTRAINT fk_gl_entries_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Posting metadata
ALTER TABLE general_ledger_entries
    ADD CONSTRAINT fk_gl_entries_posted_by
    FOREIGN KEY (posted_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Audit columns
ALTER TABLE general_ledger_entries
    ADD CONSTRAINT fk_gl_entries_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE general_ledger_entries
    ADD CONSTRAINT fk_gl_entries_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE general_ledger_entries
    ADD CONSTRAINT fk_gl_entries_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

\echo 'Foreign keys for general_ledger_entries created successfully!'
