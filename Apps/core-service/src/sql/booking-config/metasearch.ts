// =====================================================
// METASEARCH CONFIGURATION QUERIES
// =====================================================

export const METASEARCH_CONFIG_LIST_SQL = `
  SELECT
    mc.config_id,
    mc.tenant_id,
    mc.property_id,
    mc.platform,
    mc.platform_account_id,
    mc.is_active,
    mc.bid_strategy,
    mc.max_cpc,
    mc.default_cpc,
    mc.cpc_multipliers,
    mc.target_cpa,
    mc.cpa_commission_percent,
    mc.budget_daily,
    mc.budget_monthly,
    mc.currency,
    mc.rate_feed_url,
    mc.rate_feed_format,
    mc.rate_feed_frequency,
    mc.target_roas,
    mc.min_booking_value,
    mc.metadata,
    mc.created_at,
    mc.updated_at,
    mc.created_by,
    mc.updated_by
  FROM public.metasearch_configurations mc
  WHERE mc.tenant_id = $2::uuid
    AND ($3::uuid IS NULL OR mc.property_id = $3::uuid)
    AND ($4::text IS NULL OR mc.platform = $4::text)
    AND ($5::boolean IS NULL OR mc.is_active = $5::boolean)
  ORDER BY mc.platform ASC, mc.created_at DESC
  LIMIT $1
  OFFSET $6
`;

export const METASEARCH_CONFIG_BY_ID_SQL = `
  SELECT
    mc.config_id,
    mc.tenant_id,
    mc.property_id,
    mc.platform,
    mc.platform_account_id,
    mc.is_active,
    mc.bid_strategy,
    mc.max_cpc,
    mc.default_cpc,
    mc.cpc_multipliers,
    mc.target_cpa,
    mc.cpa_commission_percent,
    mc.budget_daily,
    mc.budget_monthly,
    mc.currency,
    mc.rate_feed_url,
    mc.rate_feed_format,
    mc.rate_feed_frequency,
    mc.target_roas,
    mc.min_booking_value,
    mc.metadata,
    mc.created_at,
    mc.updated_at,
    mc.created_by,
    mc.updated_by
  FROM public.metasearch_configurations mc
  WHERE mc.config_id = $1::uuid
    AND mc.tenant_id = $2::uuid
`;

// =====================================================
// METASEARCH CLICK PERFORMANCE QUERIES
// =====================================================

export const METASEARCH_CLICK_PERFORMANCE_SQL = `
  SELECT
    mc.config_id,
    mc.platform,
    COUNT(cl.click_id) AS total_clicks,
    COALESCE(SUM(cl.cost), 0) AS total_cost,
    COUNT(cl.click_id) FILTER (WHERE cl.converted = TRUE) AS total_conversions,
    COALESCE(SUM(cl.conversion_value) FILTER (WHERE cl.converted = TRUE), 0) AS total_conversion_value,
    CASE
      WHEN COUNT(cl.click_id) > 0
      THEN ROUND(COUNT(cl.click_id) FILTER (WHERE cl.converted = TRUE)::numeric / COUNT(cl.click_id) * 100, 2)
      ELSE 0
    END AS conversion_rate_pct,
    CASE
      WHEN COALESCE(SUM(cl.cost), 0) > 0
      THEN ROUND(COALESCE(SUM(cl.conversion_value) FILTER (WHERE cl.converted = TRUE), 0) / SUM(cl.cost), 2)
      ELSE 0
    END AS roas
  FROM public.metasearch_configurations mc
  LEFT JOIN public.metasearch_click_log cl
    ON cl.config_id = mc.config_id
    AND cl.tenant_id = mc.tenant_id
    AND ($4::timestamptz IS NULL OR cl.click_timestamp >= $4::timestamptz)
    AND ($5::timestamptz IS NULL OR cl.click_timestamp <= $5::timestamptz)
  WHERE mc.tenant_id = $1::uuid
    AND ($2::uuid IS NULL OR mc.property_id = $2::uuid)
    AND ($3::uuid IS NULL OR mc.config_id = $3::uuid)
  GROUP BY mc.config_id, mc.platform
  ORDER BY total_clicks DESC
`;
