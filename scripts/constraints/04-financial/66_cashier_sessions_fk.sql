-- Foreign Key Constraints for cashier_sessions table

-- Multi-Tenancy
ALTER TABLE cashier_sessions
    ADD CONSTRAINT fk_cashier_sessions_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE cashier_sessions
    ADD CONSTRAINT fk_cashier_sessions_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

-- Cashier
ALTER TABLE cashier_sessions
    ADD CONSTRAINT fk_cashier_sessions_cashier
    FOREIGN KEY (cashier_id) REFERENCES users(id)
    ON DELETE CASCADE;

-- Reconciliation
ALTER TABLE cashier_sessions
    ADD CONSTRAINT fk_cashier_sessions_reconciled_by
    FOREIGN KEY (reconciled_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Audit
ALTER TABLE cashier_sessions
    ADD CONSTRAINT fk_cashier_sessions_audited_by
    FOREIGN KEY (audited_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Approval
ALTER TABLE cashier_sessions
    ADD CONSTRAINT fk_cashier_sessions_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Review
ALTER TABLE cashier_sessions
    ADD CONSTRAINT fk_cashier_sessions_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Investigation
ALTER TABLE cashier_sessions
    ADD CONSTRAINT fk_cashier_sessions_investigated_by
    FOREIGN KEY (investigated_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Related Sessions
ALTER TABLE cashier_sessions
    ADD CONSTRAINT fk_cashier_sessions_previous
    FOREIGN KEY (previous_session_id) REFERENCES cashier_sessions(session_id)
    ON DELETE SET NULL;

ALTER TABLE cashier_sessions
    ADD CONSTRAINT fk_cashier_sessions_next
    FOREIGN KEY (next_session_id) REFERENCES cashier_sessions(session_id)
    ON DELETE SET NULL;

-- Audit Fields
ALTER TABLE cashier_sessions
    ADD CONSTRAINT fk_cashier_sessions_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE cashier_sessions
    ADD CONSTRAINT fk_cashier_sessions_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Soft Delete
ALTER TABLE cashier_sessions
    ADD CONSTRAINT fk_cashier_sessions_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
