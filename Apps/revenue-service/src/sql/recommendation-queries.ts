// ── Recommendation Engine SQL Queries ────────────────

/**
 * Gather room types for a property (optionally filtered by IDs).
 * Returns room type metadata needed for recommendation generation.
 */
export const ROOM_TYPES_FOR_PROPERTY_SQL = `
  SELECT
    rt.id AS room_type_id,
    rt.type_name,
    rt.base_rate,
    rt.max_occupancy,
    (SELECT COUNT(*) FROM rooms r
     WHERE r.room_type_id = rt.id
       AND r.tenant_id = rt.tenant_id
       AND r.property_id = $2::uuid
       AND r.status NOT IN ('OUT_OF_ORDER', 'OUT_OF_SERVICE')
       AND COALESCE(r.is_deleted, false) = false
    ) AS total_rooms
  FROM public.room_types rt
  WHERE rt.tenant_id = $1::uuid
    AND rt.property_id = $2::uuid
    AND COALESCE(rt.is_deleted, false) = false
    AND ($3::uuid[] IS NULL OR rt.id = ANY($3::uuid[]))
  ORDER BY rt.type_name
`;

/**
 * Current occupancy snapshot per room type for a given date.
 * Counts active reservations (CHECKED_IN, CONFIRMED, PENDING) that overlap the date.
 */
export const OCCUPANCY_BY_ROOM_TYPE_SQL = `
  SELECT
    r.room_type_id,
    COUNT(DISTINCT res.id) AS occupied_rooms,
    COALESCE(AVG(res.room_rate), 0) AS avg_current_rate
  FROM public.rooms r
  LEFT JOIN public.reservations res
    ON res.room_type_id = r.room_type_id
    AND res.tenant_id = r.tenant_id
    AND res.property_id = r.property_id
    AND res.check_in_date <= $3::date
    AND res.check_out_date > $3::date
    AND res.status IN ('CHECKED_IN', 'CONFIRMED', 'PENDING')
    AND COALESCE(res.is_deleted, false) = false
  WHERE r.tenant_id = $1::uuid
    AND r.property_id = $2::uuid
    AND r.status NOT IN ('OUT_OF_ORDER', 'OUT_OF_SERVICE')
    AND COALESCE(r.is_deleted, false) = false
  GROUP BY r.room_type_id
`;

/**
 * Demand calendar data for a property/date range.
 */
export const DEMAND_CALENDAR_RANGE_SQL = `
  SELECT
    dc.calendar_date,
    dc.demand_level,
    dc.occupancy_forecast,
    dc.booking_pace,
    dc.pickup_last_7_days,
    dc.pace_vs_last_year,
    dc.events
  FROM public.demand_calendar dc
  WHERE dc.tenant_id = $1::uuid
    AND dc.property_id = $2::uuid
    AND dc.calendar_date >= $3::date
    AND dc.calendar_date <= $4::date
    AND COALESCE(dc.is_deleted, false) = false
  ORDER BY dc.calendar_date
`;

/**
 * Competitor average rate per date in the range.
 */
export const COMPETITOR_AVG_RATE_SQL = `
  SELECT
    cr.rate_date,
    AVG(cr.rate_amount) AS avg_rate,
    MIN(cr.rate_amount) AS min_rate,
    MAX(cr.rate_amount) AS max_rate,
    COUNT(DISTINCT cr.competitor_name) AS competitor_count
  FROM public.competitor_rates cr
  WHERE cr.tenant_id = $1::uuid
    AND cr.property_id = $2::uuid
    AND cr.rate_date >= $3::date
    AND cr.rate_date <= $4::date
    AND COALESCE(cr.is_deleted, false) = false
  GROUP BY cr.rate_date
  ORDER BY cr.rate_date
`;

/**
 * Active pricing rules for the property to incorporate into recommendations.
 */
export const ACTIVE_PRICING_RULES_SQL = `
  SELECT
    pr.rule_id,
    pr.rule_name,
    pr.rule_type,
    pr.adjustment_type,
    pr.adjustment_value,
    pr.min_rate,
    pr.max_rate,
    pr.conditions,
    pr.applies_to_room_types,
    pr.effective_from,
    pr.effective_to
  FROM public.pricing_rules pr
  WHERE pr.tenant_id = $1::uuid
    AND pr.property_id = $2::uuid
    AND pr.is_active = true
    AND COALESCE(pr.is_deleted, false) = false
    AND (pr.effective_from IS NULL OR pr.effective_from <= $4::date)
    AND (pr.effective_to IS NULL OR pr.effective_to >= $3::date)
  ORDER BY pr.priority ASC
`;

/**
 * Revenue forecasts for the date range (latest forecast per date).
 */
export const FORECAST_FOR_RANGE_SQL = `
  SELECT DISTINCT ON (forecast_date)
    forecast_date,
    occupancy_percent,
    adr,
    room_revenue,
    forecast_scenario
  FROM public.revenue_forecasts
  WHERE tenant_id = $1::uuid
    AND property_id = $2::uuid
    AND forecast_date >= $3::date
    AND forecast_date <= $4::date
    AND forecast_scenario = 'base'
    AND COALESCE(is_deleted, false) = false
  ORDER BY forecast_date, created_at DESC
`;

/**
 * Supersede existing pending recommendations for a property/date range.
 */
export const SUPERSEDE_PENDING_RECOMMENDATIONS_SQL = `
  UPDATE public.rate_recommendations
  SET status = 'superseded',
      updated_at = NOW(),
      updated_by = $5::uuid
  WHERE tenant_id = $1::uuid
    AND property_id = $2::uuid
    AND recommendation_date >= $3::date
    AND recommendation_date <= $4::date
    AND status = 'pending'
    AND COALESCE(is_deleted, false) = false
`;

/**
 * Insert a new rate recommendation.
 */
export const INSERT_RECOMMENDATION_SQL = `
  INSERT INTO public.rate_recommendations (
    tenant_id, property_id, recommendation_date, room_type_id, rate_plan_id,
    current_rate, recommended_rate, rate_difference, rate_difference_percent,
    recommendation_action, urgency, confidence_score, confidence_level,
    current_occupancy_percent, forecasted_occupancy_percent, current_demand_level,
    booking_pace, days_until_arrival, primary_reason, contributing_factors,
    competitor_average_rate, market_position, competitor_rate_spread,
    expected_revenue_impact, expected_occupancy_impact, expected_revpar_impact,
    risk_level, risk_factors,
    alternative_rate_1, alternative_rate_1_confidence,
    alternative_rate_2, alternative_rate_2_confidence,
    status, auto_apply_eligible, auto_apply_threshold,
    model_version, data_sources_used,
    valid_until, metadata, created_by, updated_by
  ) VALUES (
    $1::uuid, $2::uuid, $3::date, $4::uuid, $5::uuid,
    $6, $7, $8, $9,
    $10, $11, $12, $13,
    $14, $15, $16,
    $17, $18, $19, $20::jsonb,
    $21, $22, $23,
    $24, $25, $26,
    $27, $28::jsonb,
    $29, $30,
    $31, $32,
    'pending', $33, $34,
    $35, $36::varchar[],
    $37::timestamptz, $38::jsonb, $39::uuid, $39::uuid
  )
  RETURNING recommendation_id
`;

/**
 * Get a recommendation by ID with tenant scoping.
 */
export const RECOMMENDATION_BY_ID_SQL = `
  SELECT
    recommendation_id, tenant_id, property_id, recommendation_date,
    room_type_id, rate_plan_id, current_rate, recommended_rate,
    status, accepted, rejected, implemented, implemented_rate,
    review_notes, rejection_reason, implementation_notes
  FROM public.rate_recommendations
  WHERE recommendation_id = $1::uuid
    AND tenant_id = $2::uuid
    AND COALESCE(is_deleted, false) = false
`;

/**
 * Approve a recommendation (pending/reviewed → accepted).
 */
export const APPROVE_RECOMMENDATION_SQL = `
  UPDATE public.rate_recommendations
  SET status = 'accepted',
      accepted = true,
      accepted_by = $3::uuid,
      accepted_at = NOW(),
      acceptance_method = 'manual',
      reviewed_by = $3::uuid,
      reviewed_at = NOW(),
      review_notes = COALESCE($4, review_notes),
      updated_at = NOW(),
      updated_by = $3::uuid
  WHERE recommendation_id = $1::uuid
    AND tenant_id = $2::uuid
    AND status IN ('pending', 'reviewed')
    AND COALESCE(is_deleted, false) = false
`;

/**
 * Reject a recommendation (pending/reviewed → rejected).
 */
export const REJECT_RECOMMENDATION_SQL = `
  UPDATE public.rate_recommendations
  SET status = 'rejected',
      rejected = true,
      rejected_by = $3::uuid,
      rejected_at = NOW(),
      rejection_reason = $4,
      reviewed_by = $3::uuid,
      reviewed_at = NOW(),
      updated_at = NOW(),
      updated_by = $3::uuid
  WHERE recommendation_id = $1::uuid
    AND tenant_id = $2::uuid
    AND status IN ('pending', 'reviewed')
    AND COALESCE(is_deleted, false) = false
`;

/**
 * Mark a recommendation as implemented after applying the rate change.
 */
export const APPLY_RECOMMENDATION_SQL = `
  UPDATE public.rate_recommendations
  SET status = 'accepted',
      implemented = true,
      implemented_rate = $4,
      implemented_at = NOW(),
      implemented_by = $3::uuid,
      implementation_notes = $5,
      updated_at = NOW(),
      updated_by = $3::uuid
  WHERE recommendation_id = $1::uuid
    AND tenant_id = $2::uuid
    AND status = 'accepted'
    AND COALESCE(is_deleted, false) = false
`;

/**
 * Auto-apply a recommendation (confidence >= threshold).
 */
export const AUTO_APPLY_RECOMMENDATION_SQL = `
  UPDATE public.rate_recommendations
  SET status = 'auto_applied',
      auto_applied = true,
      accepted = true,
      accepted_at = NOW(),
      acceptance_method = 'auto',
      implemented = true,
      implemented_rate = recommended_rate,
      implemented_at = NOW(),
      updated_at = NOW(),
      updated_by = $3::uuid
  WHERE recommendation_id = $1::uuid
    AND tenant_id = $2::uuid
    AND COALESCE(is_deleted, false) = false
`;

/**
 * Bulk approve recommendations by IDs.
 */
export const BULK_APPROVE_RECOMMENDATIONS_SQL = `
  UPDATE public.rate_recommendations
  SET status = 'accepted',
      accepted = true,
      accepted_by = $3::uuid,
      accepted_at = NOW(),
      acceptance_method = 'bulk',
      reviewed_by = $3::uuid,
      reviewed_at = NOW(),
      review_notes = COALESCE($4, review_notes),
      updated_at = NOW(),
      updated_by = $3::uuid
  WHERE recommendation_id = ANY($1::uuid[])
    AND tenant_id = $2::uuid
    AND status IN ('pending', 'reviewed')
    AND COALESCE(is_deleted, false) = false
`;
