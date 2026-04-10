export const TAX_CONFIGURATION_LIST_SQL = `
  SELECT
    t.tax_config_id,
    t.tenant_id,
    t.property_id,
    p.property_name,
    t.tax_code,
    t.tax_name,
    t.tax_description,
    t.tax_type,
    t.tax_category,
    t.country_code,
    t.state_province,
    t.city,
    t.jurisdiction_name,
    t.jurisdiction_level,
    t.tax_authority_name,
    t.tax_registration_number,
    t.tax_rate,
    t.is_percentage,
    t.fixed_amount,
    t.effective_from,
    t.effective_to,
    t.is_active,
    t.calculation_method,
    t.calculation_base,
    t.is_compound_tax,
    t.rounding_method,
    t.rounding_precision,
    t.applies_to,
    t.rate_type,
    t.display_on_invoice,
    t.display_separately,
    t.display_name,
    t.display_order,
    t.allows_exemptions,
    t.exemption_types,
    t.tax_gl_account,
    t.remittance_frequency,
    t.times_applied,
    t.total_tax_collected,
    t.last_applied_at,
    t.created_at,
    t.updated_at
  FROM public.tax_configurations t
  LEFT JOIN public.properties p ON t.property_id = p.id
  WHERE COALESCE(t.is_deleted, false) = false
    AND ($2::uuid IS NULL OR t.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR t.property_id = $3::uuid)
    AND ($4::text IS NULL OR t.tax_type = LOWER($4::text))
    AND ($5::boolean IS NULL OR t.is_active = $5::boolean)
    AND ($6::text IS NULL OR t.country_code = UPPER($6::text))
    AND ($7::text IS NULL OR t.jurisdiction_level = LOWER($7::text))
  ORDER BY COALESCE(t.display_order, 999) ASC, t.tax_name ASC
  LIMIT $1
  OFFSET $8
`;

export const TAX_CONFIGURATION_BY_ID_SQL = `
  SELECT
    t.tax_config_id,
    t.tenant_id,
    t.property_id,
    p.property_name,
    t.tax_code,
    t.tax_name,
    t.tax_description,
    t.tax_type,
    t.tax_category,
    t.country_code,
    t.state_province,
    t.city,
    t.jurisdiction_name,
    t.jurisdiction_level,
    t.tax_authority_name,
    t.tax_authority_id,
    t.tax_registration_number,
    t.tax_account_number,
    t.tax_rate,
    t.is_percentage,
    t.fixed_amount,
    t.effective_from,
    t.effective_to,
    t.is_active,
    t.calculation_method,
    t.calculation_base,
    t.is_compound_tax,
    t.compound_on_tax_codes,
    t.compound_order,
    t.rounding_method,
    t.rounding_precision,
    t.applies_to,
    t.excluded_items,
    t.rate_type,
    t.is_tiered,
    t.tier_ranges,
    t.per_person_rate,
    t.per_night_rate,
    t.max_nights,
    t.max_persons,
    t.minimum_taxable_amount,
    t.maximum_taxable_amount,
    t.minimum_tax_amount,
    t.maximum_tax_amount,
    t.allows_exemptions,
    t.exemption_types,
    t.exemption_certificate_required,
    t.applies_to_guest_types,
    t.excluded_guest_types,
    t.applies_to_rate_codes,
    t.excluded_rate_codes,
    t.applies_to_room_types,
    t.excluded_room_types,
    t.has_seasonal_rates,
    t.seasonal_rates,
    t.tax_report_category,
    t.tax_gl_account,
    t.revenue_account,
    t.liability_account,
    t.remittance_frequency,
    t.remittance_due_day,
    t.last_remittance_date,
    t.next_remittance_date,
    t.filing_required,
    t.filing_frequency,
    t.display_on_invoice,
    t.display_on_folio,
    t.display_separately,
    t.display_name,
    t.display_order,
    t.show_in_online_booking,
    t.include_in_total_price,
    t.times_applied,
    t.total_tax_collected,
    t.last_applied_at,
    t.notes,
    t.internal_notes,
    t.metadata,
    t.created_at,
    t.created_by,
    t.updated_at,
    t.updated_by
  FROM public.tax_configurations t
  LEFT JOIN public.properties p ON t.property_id = p.id
  WHERE t.tax_config_id = $1
    AND t.tenant_id = $2
    AND COALESCE(t.is_deleted, false) = false
`;

export const FISCAL_PERIOD_LIST_SQL = `
  SELECT
    fp.fiscal_period_id,
    fp.tenant_id,
    fp.property_id,
    p.property_name,
    fp.fiscal_year,
    fp.fiscal_year_start,
    fp.fiscal_year_end,
    fp.period_number,
    fp.period_name,
    fp.period_start,
    fp.period_end,
    fp.period_status,
    fp.is_reconciled,
    fp.closed_at,
    fp.soft_closed_at,
    fp.locked_at,
    fp.total_revenue,
    fp.total_expenses,
    fp.net_income,
    fp.notes
  FROM public.fiscal_periods fp
  LEFT JOIN public.properties p ON fp.property_id = p.id
  WHERE COALESCE(fp.is_deleted, false) = false
    AND fp.tenant_id = $1::uuid
    AND ($2::uuid IS NULL OR fp.property_id = $2::uuid)
  ORDER BY fp.fiscal_year DESC, fp.period_number DESC
`;
