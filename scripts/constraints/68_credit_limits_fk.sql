-- Foreign Key Constraints for credit_limits table

-- Multi-Tenancy
ALTER TABLE credit_limits
    ADD CONSTRAINT fk_credit_limits_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE credit_limits
    ADD CONSTRAINT fk_credit_limits_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

-- Customer References
ALTER TABLE credit_limits
    ADD CONSTRAINT fk_credit_limits_guest
    FOREIGN KEY (guest_id) REFERENCES guests(guest_id)
    ON DELETE SET NULL;

-- Temporary Increase
ALTER TABLE credit_limits
    ADD CONSTRAINT fk_credit_limits_temp_increase_approved_by
    FOREIGN KEY (temporary_increase_approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Review
ALTER TABLE credit_limits
    ADD CONSTRAINT fk_credit_limits_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Approval
ALTER TABLE credit_limits
    ADD CONSTRAINT fk_credit_limits_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Suspension
ALTER TABLE credit_limits
    ADD CONSTRAINT fk_credit_limits_suspended_by
    FOREIGN KEY (suspended_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Block
ALTER TABLE credit_limits
    ADD CONSTRAINT fk_credit_limits_blocked_by
    FOREIGN KEY (blocked_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Relationship Manager
ALTER TABLE credit_limits
    ADD CONSTRAINT fk_credit_limits_relationship_manager
    FOREIGN KEY (relationship_manager_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Audit Fields
ALTER TABLE credit_limits
    ADD CONSTRAINT fk_credit_limits_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE credit_limits
    ADD CONSTRAINT fk_credit_limits_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Soft Delete
ALTER TABLE credit_limits
    ADD CONSTRAINT fk_credit_limits_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
