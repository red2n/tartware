-- =====================================================
-- Foreign keys for payment_tokens table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for payment_tokens...'

-- Tenant scope (required)
ALTER TABLE payment_tokens
    ADD CONSTRAINT fk_payment_tokens_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Property scope (optional - property-level vaulting)
ALTER TABLE payment_tokens
    ADD CONSTRAINT fk_payment_tokens_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Guest association (optional)
ALTER TABLE payment_tokens
    ADD CONSTRAINT fk_payment_tokens_guest
    FOREIGN KEY (guest_id) REFERENCES guests(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Company association (optional - corporate accounts)
ALTER TABLE payment_tokens
    ADD CONSTRAINT fk_payment_tokens_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Audit columns
ALTER TABLE payment_tokens
    ADD CONSTRAINT fk_payment_tokens_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE payment_tokens
    ADD CONSTRAINT fk_payment_tokens_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE payment_tokens
    ADD CONSTRAINT fk_payment_tokens_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

\echo 'Foreign keys for payment_tokens created successfully!'
