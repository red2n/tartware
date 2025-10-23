-- Foreign Key Constraints for contract_agreements table

ALTER TABLE contract_agreements
    ADD CONSTRAINT fk_contract_agreements_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE contract_agreements
    ADD CONSTRAINT fk_contract_agreements_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE contract_agreements
    ADD CONSTRAINT fk_contract_agreements_terminated_by
    FOREIGN KEY (terminated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE contract_agreements
    ADD CONSTRAINT fk_contract_agreements_legal_reviewed_by
    FOREIGN KEY (legal_reviewed_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE contract_agreements
    ADD CONSTRAINT fk_contract_agreements_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE contract_agreements
    ADD CONSTRAINT fk_contract_agreements_parent
    FOREIGN KEY (parent_agreement_id) REFERENCES contract_agreements(agreement_id)
    ON DELETE SET NULL;

ALTER TABLE contract_agreements
    ADD CONSTRAINT fk_contract_agreements_supersedes
    FOREIGN KEY (supersedes_agreement_id) REFERENCES contract_agreements(agreement_id)
    ON DELETE SET NULL;

ALTER TABLE contract_agreements
    ADD CONSTRAINT fk_contract_agreements_superseded_by
    FOREIGN KEY (superseded_by_agreement_id) REFERENCES contract_agreements(agreement_id)
    ON DELETE SET NULL;

ALTER TABLE contract_agreements
    ADD CONSTRAINT fk_contract_agreements_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE contract_agreements
    ADD CONSTRAINT fk_contract_agreements_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE contract_agreements
    ADD CONSTRAINT fk_contract_agreements_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
