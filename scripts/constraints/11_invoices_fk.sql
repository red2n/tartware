-- =====================================================
-- 11_invoices_fk.sql
-- Foreign Key Constraints for invoices
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for invoices...'

-- Foreign key to tenants table
ALTER TABLE invoices
ADD CONSTRAINT fk_invoices_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to properties table
ALTER TABLE invoices
ADD CONSTRAINT fk_invoices_property_id
FOREIGN KEY (property_id)
REFERENCES properties(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to reservations table (nullable)
ALTER TABLE invoices
ADD CONSTRAINT fk_invoices_reservation_id
FOREIGN KEY (reservation_id)
REFERENCES reservations(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to guests table
ALTER TABLE invoices
ADD CONSTRAINT fk_invoices_guest_id
FOREIGN KEY (guest_id)
REFERENCES guests(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_invoices_tenant_id ON invoices IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with invoices.';

COMMENT ON CONSTRAINT fk_invoices_property_id ON invoices IS
'Ensures property exists. RESTRICT prevents deleting properties with invoices.';

COMMENT ON CONSTRAINT fk_invoices_reservation_id ON invoices IS
'Ensures reservation exists if specified. RESTRICT prevents deleting reservations with invoices (financial record).';

COMMENT ON CONSTRAINT fk_invoices_guest_id ON invoices IS
'Ensures guest exists. RESTRICT prevents deleting guests with invoices (financial record).';

\echo '✓ Invoices foreign keys created successfully!'
