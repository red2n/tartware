-- =============================================
-- Indexes for 93_travel_agent_commissions
-- =============================================

CREATE INDEX idx_travel_agent_commissions_tenant ON travel_agent_commissions(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_travel_agent_commissions_property ON travel_agent_commissions(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_travel_agent_commissions_company ON travel_agent_commissions(company_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_travel_agent_commissions_reservation ON travel_agent_commissions(reservation_id);
CREATE INDEX idx_travel_agent_commissions_status ON travel_agent_commissions(payment_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_travel_agent_commissions_dates ON travel_agent_commissions(period_start_date, period_end_date);
CREATE INDEX idx_travel_agent_commissions_payment_date ON travel_agent_commissions(payment_date) WHERE payment_status = 'paid';
CREATE INDEX idx_travel_agent_commissions_approval ON travel_agent_commissions(requires_approval) WHERE payment_status = 'pending';
CREATE INDEX idx_travel_agent_commissions_statement ON travel_agent_commissions(statement_number) WHERE included_in_statement = TRUE;
CREATE INDEX idx_commission_statements_company ON commission_statements(company_id);
CREATE INDEX idx_commission_statements_dates ON commission_statements(period_start_date, period_end_date);
CREATE INDEX idx_commission_statements_status ON commission_statements(payment_status);
CREATE INDEX idx_commission_statements_number ON commission_statements(statement_number);
CREATE INDEX idx_commission_rules_tenant ON commission_rules(tenant_id) WHERE is_active = TRUE;
CREATE INDEX idx_commission_rules_company ON commission_rules(company_id) WHERE is_active = TRUE;
CREATE INDEX idx_commission_rules_dates ON commission_rules(effective_from, effective_to) WHERE is_active = TRUE;
