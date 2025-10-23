-- =============================================
-- Foreign Key Constraints for 90_companies
-- =============================================

ALTER TABLE companies ADD CONSTRAINT fk_companies_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE companies ADD CONSTRAINT fk_companies_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE companies ADD CONSTRAINT fk_companies_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE companies ADD CONSTRAINT fk_companies_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);
