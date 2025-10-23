-- Foreign Key Constraints for ab_test_results table

ALTER TABLE ab_test_results ADD CONSTRAINT fk_ab_test_results_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;
ALTER TABLE ab_test_results ADD CONSTRAINT fk_ab_test_results_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE;
ALTER TABLE ab_test_results ADD CONSTRAINT fk_ab_test_results_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE ab_test_results ADD CONSTRAINT fk_ab_test_results_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE ab_test_results ADD CONSTRAINT fk_ab_test_results_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(user_id) ON DELETE SET NULL;
