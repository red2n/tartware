-- =============================================
-- Foreign Key Constraints for 93_travel_agent_commissions
-- =============================================

ALTER TABLE travel_agent_commissions ADD CONSTRAINT fk_travel_agent_commissions_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE travel_agent_commissions ADD CONSTRAINT fk_travel_agent_commissions_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE travel_agent_commissions ADD CONSTRAINT fk_travel_agent_commissions_company_id FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE RESTRICT;
ALTER TABLE travel_agent_commissions ADD CONSTRAINT fk_travel_agent_commissions_reservation_id FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE RESTRICT;
ALTER TABLE travel_agent_commissions ADD CONSTRAINT fk_travel_agent_commissions_payment_id FOREIGN KEY (payment_id) REFERENCES payments(id);
ALTER TABLE travel_agent_commissions ADD CONSTRAINT fk_travel_agent_commissions_approved_by FOREIGN KEY (approved_by) REFERENCES users(id);
ALTER TABLE travel_agent_commissions ADD CONSTRAINT fk_travel_agent_commissions_reconciled_by FOREIGN KEY (reconciled_by) REFERENCES users(id);
ALTER TABLE travel_agent_commissions ADD CONSTRAINT fk_travel_agent_commissions_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE travel_agent_commissions ADD CONSTRAINT fk_travel_agent_commissions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE travel_agent_commissions ADD CONSTRAINT fk_travel_agent_commissions_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);
ALTER TABLE commission_statements ADD CONSTRAINT fk_commission_statements_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE commission_statements ADD CONSTRAINT fk_commission_statements_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE commission_statements ADD CONSTRAINT fk_commission_statements_company_id FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE RESTRICT;
ALTER TABLE commission_statements ADD CONSTRAINT fk_commission_statements_finalized_by FOREIGN KEY (finalized_by) REFERENCES users(id);
ALTER TABLE commission_statements ADD CONSTRAINT fk_commission_statements_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE commission_statements ADD CONSTRAINT fk_commission_statements_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE commission_rules ADD CONSTRAINT fk_commission_rules_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE commission_rules ADD CONSTRAINT fk_commission_rules_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE commission_rules ADD CONSTRAINT fk_commission_rules_company_id FOREIGN KEY (company_id) REFERENCES companies(company_id) ON DELETE CASCADE;
ALTER TABLE commission_rules ADD CONSTRAINT fk_commission_rules_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE commission_rules ADD CONSTRAINT fk_commission_rules_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
