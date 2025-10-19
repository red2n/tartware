-- Foreign Key Constraints for accounts_receivable table

-- Multi-Tenancy
ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

-- Customer References
ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_guest
    FOREIGN KEY (guest_id) REFERENCES guests(guest_id)
    ON DELETE SET NULL;

-- Source Transactions
ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
    ON DELETE SET NULL;

ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
    ON DELETE SET NULL;

ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_folio
    FOREIGN KEY (folio_id) REFERENCES folios(folio_id)
    ON DELETE SET NULL;

-- Collection
ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_collection_agent
    FOREIGN KEY (collection_agent_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Write-Off
ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_written_off_by
    FOREIGN KEY (written_off_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_write_off_approved_by
    FOREIGN KEY (write_off_approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Responsible Staff
ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_account_manager
    FOREIGN KEY (account_manager_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_collection_manager
    FOREIGN KEY (collection_manager_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Reconciliation
ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_reconciled_by
    FOREIGN KEY (reconciled_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Audit Fields
ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Soft Delete
ALTER TABLE accounts_receivable
    ADD CONSTRAINT fk_accounts_receivable_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
