-- =====================================================
-- tax_configurations_seed.sql
-- Development-only default tax configuration
-- Industry Standard: US transient occupancy tax (TOT)
-- Pattern: dev/demo fixture — never a production rate
-- =====================================================
--
-- `scripts/tables/04-financial/63_tax_configurations.sql` says the default tax
-- seed "has been moved to scripts/seed/dev/tax_configurations_seed.sql". That
-- file was never created, so the row it promised never existed — while
-- `scripts/verify-installation.sql` asserts `US-OCCUPANCY-DEFAULT` is present.
-- The check could therefore never pass, and only went unnoticed because
-- verify-installation could not fail the run.
--
-- The row is seeded INACTIVE on purpose. A tax rate is a legal figure specific
-- to a jurisdiction, and this one is a placeholder: 0% under a name that says
-- so. An inactive row satisfies the structural check — "tax configuration is
-- wired up and reachable" — without any chance of a made-up rate reaching a
-- guest folio. A property configures its real rate and activates it.

\c tartware

INSERT INTO tax_configurations (
    tenant_id, property_id, tax_code, tax_name, tax_description,
    tax_type, tax_category, country_code, jurisdiction_level,
    tax_rate, is_percentage, effective_from, is_active
)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    NULL,
    'US-OCCUPANCY-DEFAULT',
    'US Occupancy Tax (template — configure per property)',
    'Inactive placeholder proving tax configuration is wired end to end. '
      'Set the real rate and jurisdiction for the property, then activate it. '
      'Never bill against this row as shipped.',
    'occupancy_tax',
    'lodging',
    'USA',
    'city',
    0.000000,
    TRUE,
    CURRENT_DATE,
    FALSE
)
ON CONFLICT (tax_code) DO NOTHING;

\echo '✓ Development tax configuration template seeded (inactive, 0%).'
