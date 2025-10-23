-- =====================================================
-- 63_tax_configurations_indexes.sql
-- Tax Configurations Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating tax_configurations indexes...'

CREATE INDEX idx_tax_configs_tenant ON tax_configurations(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_tax_configs_property ON tax_configurations(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_tax_configs_code ON tax_configurations(tax_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_tax_configs_type ON tax_configurations(tax_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_tax_configs_active ON tax_configurations(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_tax_configs_country ON tax_configurations(country_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_tax_configs_jurisdiction ON tax_configurations(country_code, state_province, city) WHERE is_deleted = FALSE;
CREATE INDEX idx_tax_configs_effective ON tax_configurations(effective_from, effective_to) WHERE is_deleted = FALSE;
-- Note: Cannot create partial index with CURRENT_DATE as it's not IMMUTABLE
-- CREATE INDEX idx_tax_configs_current ON tax_configurations(effective_from, effective_to) WHERE effective_from <= CURRENT_DATE AND (effective_to IS NULL OR effective_to >= CURRENT_DATE) AND is_deleted = FALSE;
CREATE INDEX idx_tax_configs_composite ON tax_configurations(is_part_of_composite, composite_tax_id) WHERE is_part_of_composite = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_tax_configs_remittance ON tax_configurations(remittance_frequency, next_remittance_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_tax_configs_filing ON tax_configurations(filing_required, next_filing_date) WHERE filing_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_tax_configs_registration_expiry ON tax_configurations(requires_registration, registration_expiry) WHERE requires_registration = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_tax_configs_certificate_expiry ON tax_configurations(certificate_required, certificate_expiry) WHERE certificate_required = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_tax_configs_approval ON tax_configurations(requires_approval, approved) WHERE requires_approval = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_tax_configs_metadata ON tax_configurations USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_tax_configs_tags ON tax_configurations USING gin(tags) WHERE is_deleted = FALSE;
CREATE INDEX idx_tax_configs_tier_ranges ON tax_configurations USING gin(tier_ranges) WHERE is_tiered = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_tax_configs_applies_to ON tax_configurations USING gin(applies_to) WHERE is_deleted = FALSE;
CREATE INDEX idx_tax_configs_property_active ON tax_configurations(property_id, is_active, effective_from DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_tax_configs_property_type ON tax_configurations(property_id, tax_type, is_active) WHERE is_deleted = FALSE;
CREATE INDEX idx_tax_configs_lookup ON tax_configurations(property_id, tax_code, effective_from, effective_to) WHERE is_active = TRUE AND is_deleted = FALSE;

\echo 'Tax Configurations indexes created successfully!'
