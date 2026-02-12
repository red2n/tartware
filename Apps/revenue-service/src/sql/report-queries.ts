export const REVENUE_FORECAST_LIST_SQL = `
  SELECT
    rf.forecast_id,
    rf.tenant_id,
    rf.property_id,
    p.property_name,
    rf.forecast_date,
    rf.forecast_period,
    rf.room_revenue_forecast,
    rf.total_revenue_forecast,
    rf.occupancy_forecast,
    rf.adr_forecast,
    rf.revpar_forecast,
    rf.confidence_level,
    rf.scenario_type,
    rf.created_at,
    rf.updated_at
  FROM public.revenue_forecasts rf
  LEFT JOIN public.properties p ON rf.property_id = p.id
  WHERE COALESCE(rf.is_deleted, false) = false
    AND ($2::uuid IS NULL OR rf.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR rf.property_id = $3::uuid)
    AND ($4::text IS NULL OR rf.forecast_period = LOWER($4::text))
    AND ($5::text IS NULL OR rf.scenario_type = LOWER($5::text))
  ORDER BY rf.forecast_date DESC
  LIMIT $1
  OFFSET $6
`;

export const REVENUE_GOAL_LIST_SQL = `
  SELECT
    rg.goal_id,
    rg.tenant_id,
    rg.property_id,
    p.property_name,
    rg.goal_name,
    rg.goal_type,
    rg.period_start,
    rg.period_end,
    rg.target_amount,
    rg.actual_amount,
    rg.variance_amount,
    rg.variance_percent,
    rg.status,
    rg.created_at,
    rg.updated_at
  FROM public.revenue_goals rg
  LEFT JOIN public.properties p ON rg.property_id = p.id
  WHERE COALESCE(rg.is_deleted, false) = false
    AND ($2::uuid IS NULL OR rg.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR rg.property_id = $3::uuid)
    AND ($4::text IS NULL OR rg.goal_type = LOWER($4::text))
    AND ($5::text IS NULL OR rg.status = LOWER($5::text))
  ORDER BY rg.period_start DESC
  LIMIT $1
  OFFSET $6
`;

export const REVENUE_KPI_SQL = `
  SELECT
    COUNT(r.id) FILTER (WHERE r.status IN ('CHECKED_IN', 'CHECKED_OUT')) AS occupied_rooms,
    COUNT(rt.id) AS total_rooms,
    COALESCE(SUM(cp.total_amount) FILTER (WHERE cp.charge_category = 'ROOM'), 0) AS room_revenue,
    COALESCE(SUM(cp.total_amount), 0) AS total_revenue
  FROM public.room_types rt
  CROSS JOIN LATERAL (
    SELECT 1
  ) AS stub
  LEFT JOIN public.reservations r
    ON r.property_id = rt.property_id
    AND r.status IN ('CHECKED_IN', 'CHECKED_OUT')
    AND r.check_in_date <= $3::date
    AND r.check_out_date > $3::date
  LEFT JOIN public.charge_postings cp
    ON cp.reservation_id = r.id
    AND cp.business_date = $3::date
    AND COALESCE(cp.is_voided, false) = false
    AND COALESCE(cp.is_deleted, false) = false
  WHERE rt.property_id = $1::uuid
    AND ($2::uuid IS NULL OR rt.property_id IN (
      SELECT id FROM public.properties WHERE tenant_id = $2::uuid
    ))
    AND COALESCE(rt.is_deleted, false) = false
  GROUP BY stub
`;
