-- =====================================================
-- 12_invoice_items_fk.sql
-- Foreign Key Constraints for invoice_items
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for invoice_items...'

-- Foreign key to invoices table
ALTER TABLE invoice_items
ADD CONSTRAINT fk_invoice_items_invoice_id
FOREIGN KEY (invoice_id)
REFERENCES invoices(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to tenants table
ALTER TABLE invoice_items
ADD CONSTRAINT fk_invoice_items_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_invoice_items_invoice_id ON invoice_items IS
'Ensures invoice exists. RESTRICT prevents deleting invoices with line items (financial integrity).';

COMMENT ON CONSTRAINT fk_invoice_items_tenant_id ON invoice_items IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with invoice items.';

\echo '✓ Invoice_items foreign keys created successfully!'
