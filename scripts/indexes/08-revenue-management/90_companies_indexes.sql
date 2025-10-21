-- =============================================
-- Indexes for 90_companies
-- =============================================

CREATE INDEX idx_companies_tenant ON companies(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_companies_type ON companies(company_type) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_companies_code ON companies(company_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_companies_name ON companies(company_name) WHERE is_deleted = FALSE;
CREATE INDEX idx_companies_credit_status ON companies(credit_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_companies_contract_expiry ON companies(contract_end_date) WHERE contract_status = 'active' AND is_deleted = FALSE;
CREATE INDEX idx_companies_active ON companies(is_active, company_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_companies_balance ON companies(current_balance) WHERE current_balance > 0 AND is_deleted = FALSE;
