-- =====================================================
-- 10_payments_fk.sql
-- Foreign Key Constraints for payments
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for payments...'

-- Foreign key to tenants table
ALTER TABLE payments
ADD CONSTRAINT fk_payments_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to properties table
ALTER TABLE payments
ADD CONSTRAINT fk_payments_property_id
FOREIGN KEY (property_id)
REFERENCES properties(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to reservations table (nullable)
ALTER TABLE payments
ADD CONSTRAINT fk_payments_reservation_id
FOREIGN KEY (reservation_id)
REFERENCES reservations(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to guests table (nullable)
ALTER TABLE payments
ADD CONSTRAINT fk_payments_guest_id
FOREIGN KEY (guest_id)
REFERENCES guests(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_payments_tenant_id ON payments IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with payments.';

COMMENT ON CONSTRAINT fk_payments_property_id ON payments IS
'Ensures property exists. RESTRICT prevents deleting properties with payments.';

COMMENT ON CONSTRAINT fk_payments_reservation_id ON payments IS
'Ensures reservation exists if specified. RESTRICT prevents deleting reservations with payments (financial record).';

COMMENT ON CONSTRAINT fk_payments_guest_id ON payments IS
'Ensures guest exists if specified. RESTRICT prevents deleting guests with payments (financial record).';

\echo '✓ Payments foreign keys created successfully!'
