-- Foreign Key Constraints for vendor_contracts table

-- Multi-Tenancy
ALTER TABLE vendor_contracts
    ADD CONSTRAINT fk_vendor_contracts_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE vendor_contracts
    ADD CONSTRAINT fk_vendor_contracts_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

-- Contract Management
ALTER TABLE vendor_contracts
    ADD CONSTRAINT fk_vendor_contracts_owner
    FOREIGN KEY (contract_owner) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE vendor_contracts
    ADD CONSTRAINT fk_vendor_contracts_approver
    FOREIGN KEY (approver_id) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE vendor_contracts
    ADD CONSTRAINT fk_vendor_contracts_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Legal Review
ALTER TABLE vendor_contracts
    ADD CONSTRAINT fk_vendor_contracts_legal_reviewer
    FOREIGN KEY (legal_reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Termination
ALTER TABLE vendor_contracts
    ADD CONSTRAINT fk_vendor_contracts_terminated_by
    FOREIGN KEY (terminated_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Related Contracts
ALTER TABLE vendor_contracts
    ADD CONSTRAINT fk_vendor_contracts_parent
    FOREIGN KEY (parent_contract_id) REFERENCES vendor_contracts(contract_id)
    ON DELETE SET NULL;

ALTER TABLE vendor_contracts
    ADD CONSTRAINT fk_vendor_contracts_supersedes
    FOREIGN KEY (supersedes_contract_id) REFERENCES vendor_contracts(contract_id)
    ON DELETE SET NULL;

ALTER TABLE vendor_contracts
    ADD CONSTRAINT fk_vendor_contracts_superseded_by
    FOREIGN KEY (superseded_by_contract_id) REFERENCES vendor_contracts(contract_id)
    ON DELETE SET NULL;

-- Audit Fields
ALTER TABLE vendor_contracts
    ADD CONSTRAINT fk_vendor_contracts_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE vendor_contracts
    ADD CONSTRAINT fk_vendor_contracts_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

-- Soft Delete
ALTER TABLE vendor_contracts
    ADD CONSTRAINT fk_vendor_contracts_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
