-- =============================================
-- Foreign Key Constraints for 98_sustainability_metrics
-- =============================================

ALTER TABLE sustainability_metrics ADD CONSTRAINT fk_sustainability_metrics_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE sustainability_metrics ADD CONSTRAINT fk_sustainability_metrics_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE sustainability_metrics ADD CONSTRAINT fk_sustainability_metrics_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE sustainability_metrics ADD CONSTRAINT fk_sustainability_metrics_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE green_certifications ADD CONSTRAINT fk_green_certifications_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE green_certifications ADD CONSTRAINT fk_green_certifications_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE green_certifications ADD CONSTRAINT fk_green_certifications_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE green_certifications ADD CONSTRAINT fk_green_certifications_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE carbon_offset_programs ADD CONSTRAINT fk_carbon_offset_programs_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE carbon_offset_programs ADD CONSTRAINT fk_carbon_offset_programs_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE carbon_offset_programs ADD CONSTRAINT fk_carbon_offset_programs_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE carbon_offset_programs ADD CONSTRAINT fk_carbon_offset_programs_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE sustainability_initiatives ADD CONSTRAINT fk_sustainability_initiatives_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE sustainability_initiatives ADD CONSTRAINT fk_sustainability_initiatives_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE sustainability_initiatives ADD CONSTRAINT fk_sustainability_initiatives_project_lead FOREIGN KEY (project_lead) REFERENCES users(id);
ALTER TABLE sustainability_initiatives ADD CONSTRAINT fk_sustainability_initiatives_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE sustainability_initiatives ADD CONSTRAINT fk_sustainability_initiatives_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
