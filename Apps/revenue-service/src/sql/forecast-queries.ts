/**
 * SQL queries for forecast accuracy tracking (R13) and forecast adjustments (R12).
 */

/**
 * Evaluate forecast accuracy for a single business date.
 * Fetches actual occupancy/ADR/revenue from reservations and rooms,
 * then updates all daily forecasts whose period covers that date.
 *
 * Params: $1 tenant_id, $2 property_id, $3 business_date, $4 actor_id
 */
export const FORECAST_EVALUATE_SQL = `
  WITH actuals AS (
    SELECT
      COUNT(DISTINCT r.id) AS occupied_rooms,
      COALESCE(SUM(r.room_rate), 0) AS room_revenue,
      CASE WHEN COUNT(r.id) > 0
        THEN ROUND(AVG(r.room_rate)::numeric, 2) ELSE 0 END AS actual_adr
    FROM reservations r
    WHERE r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.status IN ('CHECKED_IN', 'CHECKED_OUT')
      AND r.is_deleted = false
      AND r.check_in_date <= $3::date
      AND r.check_out_date > $3::date
  ),
  room_count AS (
    SELECT COUNT(*) AS total_rooms
    FROM rooms
    WHERE tenant_id = $1::uuid
      AND property_id = $2::uuid
      AND status NOT IN ('OUT_OF_ORDER')
      AND is_deleted = false
  ),
  computed AS (
    SELECT
      a.occupied_rooms,
      a.room_revenue,
      a.actual_adr,
      CASE WHEN rc.total_rooms > 0
        THEN ROUND((a.occupied_rooms::numeric / rc.total_rooms) * 100, 2)
        ELSE 0 END AS actual_occ,
      CASE WHEN rc.total_rooms > 0
        THEN ROUND(a.room_revenue / rc.total_rooms, 2)
        ELSE 0 END AS actual_revpar
    FROM actuals a, room_count rc
  )
  UPDATE revenue_forecasts rf
  SET
    actual_value = c.room_revenue,
    variance = rf.room_revenue_forecast - c.room_revenue,
    variance_percent = CASE
      WHEN c.room_revenue > 0
        THEN ROUND(((rf.room_revenue_forecast - c.room_revenue) / c.room_revenue) * 100, 2)
      ELSE NULL END,
    accuracy_score = CASE
      WHEN c.room_revenue > 0
        THEN GREATEST(0, ROUND(100 - ABS(((rf.room_revenue_forecast - c.room_revenue) / c.room_revenue) * 100), 2))
      ELSE NULL END,
    updated_by = $4::uuid,
    updated_at = CURRENT_TIMESTAMP
  FROM computed c
  WHERE rf.tenant_id = $1::uuid
    AND rf.property_id = $2::uuid
    AND rf.forecast_period = 'daily'
    AND rf.period_start_date <= $3::date
    AND rf.period_end_date > $3::date
    AND rf.actual_value IS NULL
`;

/**
 * List forecast accuracy records for a date range (forecasts that have actuals).
 *
 * Params: $1 tenant_id, $2 property_id, $3 start_date, $4 end_date, $5 scenario (nullable)
 */
export const FORECAST_ACCURACY_LIST_SQL = `
  SELECT
    forecast_id,
    forecast_date,
    period_start_date,
    period_end_date,
    forecast_scenario,
    forecasted_occupancy_percent,
    forecasted_adr,
    forecasted_revpar,
    room_revenue_forecast,
    -- Compute actuals from the stored accuracy fields
    CASE WHEN actual_value IS NOT NULL THEN
      ROUND(actual_value / NULLIF(
        (SELECT COUNT(*) FROM rooms
         WHERE tenant_id = rf.tenant_id AND property_id = rf.property_id
           AND status NOT IN ('OUT_OF_ORDER') AND is_deleted = false
        ), 0) * 100 / NULLIF(forecasted_revpar, 0) * forecasted_occupancy_percent / 100, 2)
    ELSE NULL END AS actual_occupancy,
    CASE WHEN actual_value IS NOT NULL AND forecasted_occupancy_percent > 0 THEN
      ROUND(actual_value / (
        (SELECT COUNT(*) FROM rooms
         WHERE tenant_id = rf.tenant_id AND property_id = rf.property_id
           AND status NOT IN ('OUT_OF_ORDER') AND is_deleted = false
        ) * forecasted_occupancy_percent / 100
      ), 2)
    ELSE NULL END AS actual_adr,
    CASE WHEN actual_value IS NOT NULL THEN
      ROUND(actual_value / NULLIF(
        (SELECT COUNT(*) FROM rooms
         WHERE tenant_id = rf.tenant_id AND property_id = rf.property_id
           AND status NOT IN ('OUT_OF_ORDER') AND is_deleted = false
        ), 0), 2)
    ELSE NULL END AS actual_revpar,
    actual_value AS actual_room_revenue,
    variance_percent,
    accuracy_score
  FROM revenue_forecasts rf
  WHERE rf.tenant_id = $1::uuid
    AND rf.property_id = $2::uuid
    AND rf.forecast_period = 'daily'
    AND rf.period_start_date >= $3::date
    AND rf.period_end_date <= ($4::date + INTERVAL '1 day')
    AND rf.actual_value IS NOT NULL
    AND ($5::text IS NULL OR rf.forecast_scenario = $5)
  ORDER BY rf.period_start_date, rf.forecast_scenario
`;

/**
 * Manual forecast adjustment (R12).
 * Updates specific forecast fields and records the adjustment reason.
 *
 * Params: $1 tenant_id, $2 property_id, $3 forecast_date, $4 period, $5 scenario,
 *         $6 occupancy_pct (nullable), $7 adr (nullable), $8 room_revenue (nullable),
 *         $9 reason, $10 actor_id
 */
export const FORECAST_ADJUST_SQL = `
  UPDATE revenue_forecasts
  SET
    forecasted_occupancy_percent = COALESCE($6, forecasted_occupancy_percent),
    forecasted_adr = COALESCE($7, forecasted_adr),
    room_revenue_forecast = COALESCE($8, room_revenue_forecast),
    forecasted_revpar = CASE
      WHEN $6 IS NOT NULL AND $7 IS NOT NULL
        THEN ROUND(($6::numeric / 100) * $7::numeric, 2)
      WHEN $6 IS NOT NULL
        THEN ROUND(($6::numeric / 100) * COALESCE(forecasted_adr, 0), 2)
      WHEN $7 IS NOT NULL
        THEN ROUND((COALESCE(forecasted_occupancy_percent, 0) / 100) * $7::numeric, 2)
      ELSE forecasted_revpar
    END,
    manual_adjustment = TRUE,
    manual_adjustment_reason = $9,
    adjusted_by = $10::uuid,
    adjusted_at = CURRENT_TIMESTAMP,
    review_status = 'pending',
    updated_by = $10::uuid,
    updated_at = CURRENT_TIMESTAMP
  WHERE tenant_id = $1::uuid
    AND property_id = $2::uuid
    AND period_start_date <= $3::date
    AND period_end_date > $3::date
    AND forecast_period = $4
    AND forecast_scenario = $5
`;
