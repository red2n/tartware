-- Foreign Key Constraints for commission_tracking table

-- Multi-Tenancy
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

-- Beneficiaries
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_staff
    FOREIGN KEY (staff_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Source Transactions
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
    ON DELETE SET NULL;

ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
    ON DELETE SET NULL;

ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_payment
    FOREIGN KEY (payment_id) REFERENCES payments(payment_id)
    ON DELETE SET NULL;

-- Guest
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_guest
    FOREIGN KEY (guest_id) REFERENCES guests(guest_id)
    ON DELETE SET NULL;

-- Approval
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Payment
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_paid_by
    FOREIGN KEY (paid_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Split Commission
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_primary
    FOREIGN KEY (primary_commission_id) REFERENCES commission_tracking(commission_id)
    ON DELETE SET NULL;

-- Reversal
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_reversed_by
    FOREIGN KEY (reversed_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_original
    FOREIGN KEY (original_commission_id) REFERENCES commission_tracking(commission_id)
    ON DELETE SET NULL;

-- Adjustment
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_adjusted_by
    FOREIGN KEY (adjusted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Dispute
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_dispute_filed_by
    FOREIGN KEY (dispute_filed_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Contract/Agreement
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_contract
    FOREIGN KEY (contract_id) REFERENCES vendor_contracts(contract_id)
    ON DELETE SET NULL;

-- Reconciliation
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_reconciled_by
    FOREIGN KEY (reconciled_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Related Commissions
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_parent
    FOREIGN KEY (parent_commission_id) REFERENCES commission_tracking(commission_id)
    ON DELETE SET NULL;

-- Audit Fields
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Soft Delete
ALTER TABLE commission_tracking
    ADD CONSTRAINT fk_commission_tracking_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
