-- Foreign Key Constraints for financial_closures table

-- Multi-Tenancy
ALTER TABLE financial_closures
    ADD CONSTRAINT fk_financial_closures_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE financial_closures
    ADD CONSTRAINT fk_financial_closures_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

-- GL Posting
ALTER TABLE financial_closures
    ADD CONSTRAINT fk_financial_closures_gl_posted_by
    FOREIGN KEY (gl_posted_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Approval & Review
ALTER TABLE financial_closures
    ADD CONSTRAINT fk_financial_closures_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE financial_closures
    ADD CONSTRAINT fk_financial_closures_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE financial_closures
    ADD CONSTRAINT fk_financial_closures_verified_by
    FOREIGN KEY (verified_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE financial_closures
    ADD CONSTRAINT fk_financial_closures_audited_by
    FOREIGN KEY (audited_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Reopening
ALTER TABLE financial_closures
    ADD CONSTRAINT fk_financial_closures_reopened_by
    FOREIGN KEY (reopened_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Lock Period
ALTER TABLE financial_closures
    ADD CONSTRAINT fk_financial_closures_locked_by
    FOREIGN KEY (locked_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Previous Period
ALTER TABLE financial_closures
    ADD CONSTRAINT fk_financial_closures_previous
    FOREIGN KEY (previous_closure_id) REFERENCES financial_closures(closure_id)
    ON DELETE SET NULL;

-- Audit Fields
ALTER TABLE financial_closures
    ADD CONSTRAINT fk_financial_closures_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE financial_closures
    ADD CONSTRAINT fk_financial_closures_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Soft Delete
ALTER TABLE financial_closures
    ADD CONSTRAINT fk_financial_closures_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
