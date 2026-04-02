// ── Revenue Goal Write Queries ──────────────────────

export const REVENUE_GOAL_INSERT_SQL = `
  INSERT INTO public.revenue_goals (
    tenant_id, property_id, goal_name, goal_type, goal_period, goal_category,
    period_start_date, period_end_date, fiscal_year, fiscal_quarter,
    goal_amount, goal_percent, goal_count, currency,
    baseline_amount, baseline_source,
    segment_goals, channel_goals, room_type_goals,
    department, responsible_user_id, notes, metadata,
    status, created_by, updated_by
  ) VALUES (
    $1::uuid, $2::uuid, $3, $4, $5, $6,
    $7::date, $8::date, $9, $10,
    $11, $12, $13, $14,
    $15, $16,
    $17::jsonb, $18::jsonb, $19::jsonb,
    $20, $21::uuid, $22, $23::jsonb,
    'active', $24::uuid, $24::uuid
  )
  RETURNING goal_id, created_at, updated_at
`;

export const REVENUE_GOAL_UPDATE_SQL = `
  UPDATE public.revenue_goals
  SET
    goal_name = COALESCE($3, goal_name),
    goal_amount = COALESCE($4, goal_amount),
    goal_percent = COALESCE($5, goal_percent),
    goal_count = COALESCE($6, goal_count),
    period_start_date = COALESCE($7::date, period_start_date),
    period_end_date = COALESCE($8::date, period_end_date),
    status = COALESCE($9, status),
    baseline_amount = COALESCE($10, baseline_amount),
    segment_goals = COALESCE($11::jsonb, segment_goals),
    channel_goals = COALESCE($12::jsonb, channel_goals),
    room_type_goals = COALESCE($13::jsonb, room_type_goals),
    department = COALESCE($14, department),
    notes = COALESCE($15, notes),
    metadata = COALESCE($16::jsonb, metadata),
    updated_by = $17::uuid,
    updated_at = CURRENT_TIMESTAMP
  WHERE goal_id = $1::uuid
    AND tenant_id = $2::uuid
    AND COALESCE(is_deleted, false) = false
  RETURNING goal_id, updated_at
`;

export const REVENUE_GOAL_SOFT_DELETE_SQL = `
  UPDATE public.revenue_goals
  SET is_deleted = true,
      status = 'cancelled',
      deleted_at = CURRENT_TIMESTAMP,
      deleted_by = $3::uuid,
      updated_at = CURRENT_TIMESTAMP
  WHERE goal_id = $1::uuid
    AND tenant_id = $2::uuid
    AND COALESCE(is_deleted, false) = false
  RETURNING goal_id
`;

/**
 * Snapshots actual performance into revenue goals.
 * Computes room revenue, total revenue, occupancy, ADR, RevPAR from
 * reservations and charge_postings for the goal period.
 */
export const REVENUE_GOAL_TRACK_ACTUAL_SQL = `
  WITH goal_kpis AS (
    SELECT
      rg.goal_id,
      rg.goal_type,
      rg.goal_amount,
      rg.goal_percent,
      rg.goal_count,
      COALESCE(SUM(cp.total_amount) FILTER (WHERE cp.charge_category = 'ROOM'), 0) AS room_revenue,
      COALESCE(SUM(cp.total_amount), 0) AS total_revenue,
      COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('CHECKED_IN', 'CHECKED_OUT')) AS rooms_sold,
      COUNT(DISTINCT rt.id) AS total_room_types
    FROM public.revenue_goals rg
    LEFT JOIN public.reservations r
      ON r.property_id = rg.property_id
      AND r.tenant_id = rg.tenant_id
      AND r.status IN ('CHECKED_IN', 'CHECKED_OUT')
      AND r.check_in_date >= rg.period_start_date
      AND r.check_in_date <= $3::date
    LEFT JOIN public.charge_postings cp
      ON cp.reservation_id = r.id
      AND cp.business_date >= rg.period_start_date
      AND cp.business_date <= $3::date
      AND COALESCE(cp.is_voided, false) = false
      AND COALESCE(cp.is_deleted, false) = false
    LEFT JOIN public.room_types rt
      ON rt.property_id = rg.property_id
      AND rt.tenant_id = rg.tenant_id
      AND COALESCE(rt.is_deleted, false) = false
    WHERE rg.property_id = $1::uuid
      AND rg.tenant_id = $2::uuid
      AND COALESCE(rg.is_deleted, false) = false
      AND rg.status = 'active'
      AND rg.period_start_date <= $3::date
      AND rg.period_end_date >= $3::date
    GROUP BY rg.goal_id, rg.goal_type, rg.goal_amount, rg.goal_percent, rg.goal_count
  )
  UPDATE public.revenue_goals rg
  SET
    actual_amount = CASE gk.goal_type
      WHEN 'room_revenue' THEN gk.room_revenue
      WHEN 'total_revenue' THEN gk.total_revenue
      WHEN 'rooms_sold' THEN gk.rooms_sold
      ELSE gk.total_revenue
    END,
    actual_count = CASE gk.goal_type
      WHEN 'rooms_sold' THEN gk.rooms_sold::int
      ELSE rg.actual_count
    END,
    variance_amount = CASE
      WHEN gk.goal_amount IS NOT NULL AND gk.goal_amount > 0 THEN
        (CASE gk.goal_type
          WHEN 'room_revenue' THEN gk.room_revenue
          WHEN 'total_revenue' THEN gk.total_revenue
          WHEN 'rooms_sold' THEN gk.rooms_sold
          ELSE gk.total_revenue
        END) - gk.goal_amount
      ELSE NULL
    END,
    variance_percent = CASE
      WHEN gk.goal_amount IS NOT NULL AND gk.goal_amount > 0 THEN
        ROUND(((CASE gk.goal_type
          WHEN 'room_revenue' THEN gk.room_revenue
          WHEN 'total_revenue' THEN gk.total_revenue
          WHEN 'rooms_sold' THEN gk.rooms_sold
          ELSE gk.total_revenue
        END) - gk.goal_amount) / gk.goal_amount * 100, 2)
      ELSE NULL
    END,
    variance_status = CASE
      WHEN gk.goal_amount IS NOT NULL AND gk.goal_amount > 0 THEN
        CASE
          WHEN ((CASE gk.goal_type
            WHEN 'room_revenue' THEN gk.room_revenue
            WHEN 'total_revenue' THEN gk.total_revenue
            WHEN 'rooms_sold' THEN gk.rooms_sold
            ELSE gk.total_revenue
          END) - gk.goal_amount) / gk.goal_amount * 100 >= 5 THEN 'exceeded'
          WHEN ((CASE gk.goal_type
            WHEN 'room_revenue' THEN gk.room_revenue
            WHEN 'total_revenue' THEN gk.total_revenue
            WHEN 'rooms_sold' THEN gk.rooms_sold
            ELSE gk.total_revenue
          END) - gk.goal_amount) / gk.goal_amount * 100 >= -2 THEN 'on_track'
          WHEN ((CASE gk.goal_type
            WHEN 'room_revenue' THEN gk.room_revenue
            WHEN 'total_revenue' THEN gk.total_revenue
            WHEN 'rooms_sold' THEN gk.rooms_sold
            ELSE gk.total_revenue
          END) - gk.goal_amount) / gk.goal_amount * 100 >= -10 THEN 'behind'
          ELSE 'significantly_behind'
        END
      ELSE rg.variance_status
    END,
    days_elapsed = ($3::date - rg.period_start_date),
    days_remaining = (rg.period_end_date - $3::date),
    progress_percent = CASE
      WHEN gk.goal_amount IS NOT NULL AND gk.goal_amount > 0 THEN
        LEAST(ROUND((CASE gk.goal_type
          WHEN 'room_revenue' THEN gk.room_revenue
          WHEN 'total_revenue' THEN gk.total_revenue
          WHEN 'rooms_sold' THEN gk.rooms_sold
          ELSE gk.total_revenue
        END) / gk.goal_amount * 100, 2), 999.99)
      ELSE rg.progress_percent
    END,
    updated_by = $4::uuid,
    updated_at = CURRENT_TIMESTAMP
  FROM goal_kpis gk
  WHERE rg.goal_id = gk.goal_id
  RETURNING rg.goal_id, rg.actual_amount, rg.variance_amount, rg.variance_percent, rg.variance_status
`;

// ── Budget Variance Report Query (R9) ──────────────

export const BUDGET_VARIANCE_REPORT_SQL = `
  SELECT
    rg.goal_id,
    rg.goal_name,
    rg.goal_type,
    rg.goal_period,
    rg.goal_category,
    rg.department,
    rg.period_start_date,
    rg.period_end_date,
    rg.goal_amount AS budgeted_amount,
    rg.actual_amount,
    rg.variance_amount,
    rg.variance_percent,
    rg.variance_status,
    rg.progress_percent,
    rg.same_period_last_year_actual AS last_year_actual,
    rg.yoy_growth_actual_percent,
    rg.segment_goals,
    rg.channel_goals,
    rg.room_type_goals,
    rg.daily_run_rate_required,
    rg.daily_run_rate_actual
  FROM public.revenue_goals rg
  WHERE rg.tenant_id = $1::uuid
    AND rg.property_id = $2::uuid
    AND COALESCE(rg.is_deleted, false) = false
    AND rg.status = 'active'
    AND rg.period_start_date >= $3::date
    AND rg.period_end_date <= $4::date
    AND ($5::text IS NULL OR rg.department = $5::text)
    AND ($6::text IS NULL OR rg.goal_type = LOWER($6::text))
  ORDER BY rg.period_start_date, rg.goal_type
  LIMIT $7
  OFFSET $8
`;

// ── Manager's Daily Report Query (R10) ──────────────

/**
 * Multi-section CTE query for the Manager's Daily Report.
 * Returns occupancy, revenue, rate metrics, segment mix — all for one business date.
 * Forecast and pace sections are separate queries for clarity.
 */
export const MANAGERS_DAILY_REPORT_SQL = `
  WITH
  -- Section 1: Occupancy
  occupancy AS (
    SELECT
      COUNT(rm.id) AS total_rooms,
      COUNT(rm.id) FILTER (WHERE rm.status = 'OCCUPIED') AS rooms_sold,
      COUNT(rm.id) FILTER (WHERE rm.status IN ('AVAILABLE', 'CLEAN', 'INSPECTED', 'DIRTY')) AS rooms_available,
      COUNT(rm.id) FILTER (WHERE rm.status = 'OUT_OF_ORDER') AS rooms_ooo,
      COUNT(rm.id) FILTER (WHERE rm.status = 'OUT_OF_SERVICE') AS rooms_oos
    FROM public.rooms rm
    WHERE rm.property_id = $1::uuid
      AND rm.tenant_id = $2::uuid
      AND COALESCE(rm.is_deleted, false) = false
  ),
  -- Section 2: Revenue from charge postings
  revenue AS (
    SELECT
      COALESCE(SUM(cp.total_amount) FILTER (WHERE cp.charge_category = 'ROOM'), 0) AS room_revenue,
      COALESCE(SUM(cp.total_amount) FILTER (WHERE cp.charge_category = 'FB'), 0) AS fb_revenue,
      COALESCE(SUM(cp.total_amount) FILTER (WHERE cp.charge_category NOT IN ('ROOM', 'FB')), 0) AS other_revenue,
      COALESCE(SUM(cp.total_amount), 0) AS total_revenue
    FROM public.charge_postings cp
    JOIN public.reservations r ON cp.reservation_id = r.id
    WHERE r.property_id = $1::uuid
      AND r.tenant_id = $2::uuid
      AND cp.business_date = $3::date
      AND COALESCE(cp.is_voided, false) = false
      AND COALESCE(cp.is_deleted, false) = false
  ),
  -- Section 3: Arrivals / Departures counts
  movements AS (
    SELECT
      COUNT(*) FILTER (WHERE r.check_in_date = $3::date AND r.status IN ('PENDING', 'CONFIRMED')) AS expected_arrivals,
      COUNT(*) FILTER (WHERE r.check_in_date = $3::date AND r.status = 'CHECKED_IN') AS actual_arrivals,
      COUNT(*) FILTER (WHERE r.check_out_date = $3::date AND r.status = 'CHECKED_IN') AS expected_departures,
      COUNT(*) FILTER (WHERE r.check_out_date = $3::date AND r.status = 'CHECKED_OUT') AS actual_departures,
      COUNT(*) FILTER (WHERE r.status = 'CHECKED_IN') AS in_house_guests,
      COUNT(*) FILTER (WHERE r.status = 'NO_SHOW' AND r.no_show_date = $3::date) AS no_shows
    FROM public.reservations r
    WHERE r.property_id = $1::uuid
      AND r.tenant_id = $2::uuid
      AND COALESCE(r.is_deleted, false) = false
  ),
  -- Section 4: Segment mix
  segment_mix AS (
    SELECT
      r.reservation_type AS segment,
      COUNT(*) AS reservations,
      COALESCE(SUM(cp.total_amount), 0) AS segment_revenue
    FROM public.reservations r
    LEFT JOIN public.charge_postings cp
      ON cp.reservation_id = r.id
      AND cp.business_date = $3::date
      AND COALESCE(cp.is_voided, false) = false
      AND COALESCE(cp.is_deleted, false) = false
    WHERE r.property_id = $1::uuid
      AND r.tenant_id = $2::uuid
      AND r.status IN ('CHECKED_IN', 'CHECKED_OUT')
      AND r.check_in_date <= $3::date
      AND r.check_out_date > $3::date
    GROUP BY r.reservation_type
  ),
  -- Section 5: Budget comparison
  budget AS (
    SELECT
      rg.goal_type,
      rg.goal_amount AS budgeted_amount,
      rg.actual_amount AS budget_actual,
      rg.variance_percent AS budget_variance_pct
    FROM public.revenue_goals rg
    WHERE rg.property_id = $1::uuid
      AND rg.tenant_id = $2::uuid
      AND COALESCE(rg.is_deleted, false) = false
      AND rg.status = 'active'
      AND rg.period_start_date <= $3::date
      AND rg.period_end_date >= $3::date
  )
  SELECT
    -- Occupancy section
    o.total_rooms,
    o.rooms_sold,
    o.rooms_available,
    o.rooms_ooo,
    o.rooms_oos,
    -- Revenue section
    rev.room_revenue,
    rev.fb_revenue,
    rev.other_revenue,
    rev.total_revenue,
    -- Movements section
    m.expected_arrivals,
    m.actual_arrivals,
    m.expected_departures,
    m.actual_departures,
    m.in_house_guests,
    m.no_shows,
    -- Segment mix as JSONB array
    (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'segment', sm.segment,
      'reservations', sm.reservations,
      'revenue', sm.segment_revenue
    )), '[]'::jsonb) FROM segment_mix sm) AS segment_mix,
    -- Budget as JSONB array
    (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'goal_type', b.goal_type,
      'budgeted', b.budgeted_amount,
      'actual', b.budget_actual,
      'variance_pct', b.budget_variance_pct
    )), '[]'::jsonb) FROM budget b) AS budget_comparison
  FROM occupancy o
  CROSS JOIN revenue rev
  CROSS JOIN movements m
`;

/**
 * Forecast section for Manager's Daily Report.
 * Returns forecasts for the next 7, 14, and 30 days.
 */
export const MANAGERS_FORECAST_SQL = `
  SELECT
    rf.forecast_date,
    rf.occupancy_forecast,
    rf.adr_forecast,
    rf.revpar_forecast,
    rf.room_revenue_forecast,
    rf.confidence_level
  FROM public.revenue_forecasts rf
  WHERE rf.property_id = $1::uuid
    AND rf.tenant_id = $2::uuid
    AND rf.forecast_date > $3::date
    AND rf.forecast_date <= ($3::date + $4::int)
    AND rf.scenario_type = 'base'
    AND rf.forecast_period = 'daily'
    AND COALESCE(rf.is_deleted, false) = false
  ORDER BY rf.forecast_date
`;

/**
 * Last year same-day KPIs for Manager's Daily Report comparison.
 */
export const MANAGERS_LAST_YEAR_SQL = `
  SELECT
    COUNT(rm.id) FILTER (WHERE rm.status = 'OCCUPIED') AS ly_rooms_sold,
    COUNT(rm.id) AS ly_total_rooms,
    COALESCE(SUM(cp.total_amount) FILTER (WHERE cp.charge_category = 'ROOM'), 0) AS ly_room_revenue,
    COALESCE(SUM(cp.total_amount), 0) AS ly_total_revenue
  FROM public.rooms rm
  LEFT JOIN public.reservations r
    ON r.property_id = rm.property_id
    AND r.room_number = rm.room_number
    AND r.status IN ('CHECKED_IN', 'CHECKED_OUT')
    AND r.check_in_date <= ($3::date - INTERVAL '1 year')
    AND r.check_out_date > ($3::date - INTERVAL '1 year')
  LEFT JOIN public.charge_postings cp
    ON cp.reservation_id = r.id
    AND cp.business_date = ($3::date - INTERVAL '1 year')
    AND COALESCE(cp.is_voided, false) = false
    AND COALESCE(cp.is_deleted, false) = false
  WHERE rm.property_id = $1::uuid
    AND rm.tenant_id = $2::uuid
    AND COALESCE(rm.is_deleted, false) = false
    AND rm.status NOT IN ('OUT_OF_ORDER', 'OUT_OF_SERVICE')
`;
