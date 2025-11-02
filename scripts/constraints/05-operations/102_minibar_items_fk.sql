-- =====================================================
-- Foreign Keys for minibar_items table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for minibar_items...'

-- Tenant reference
ALTER TABLE minibar_items
    ADD CONSTRAINT fk_minibar_items_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

-- Property reference
ALTER TABLE minibar_items
    ADD CONSTRAINT fk_minibar_items_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

-- Note: supplier_id could reference a suppliers table if it exists
-- Uncomment if suppliers table is available:
-- ALTER TABLE minibar_items
--     ADD CONSTRAINT fk_minibar_items_supplier
--     FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
--     ON DELETE SET NULL;

\echo 'Foreign keys for minibar_items created successfully!'
