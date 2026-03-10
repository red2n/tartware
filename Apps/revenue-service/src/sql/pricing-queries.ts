export const PRICING_RULE_LIST_SQL = `
  SELECT
    pr.rule_id,
    pr.tenant_id,
    pr.property_id,
    p.property_name,
    pr.rule_name,
    pr.rule_type,
    pr.priority,
    pr.is_active,
    pr.effective_from,
    pr.effective_to,
    pr.applies_to_room_types,
    pr.applies_to_rate_plans,
    pr.condition_type,
    pr.condition_value,
    pr.adjustment_type,
    pr.adjustment_value,
    pr.min_rate,
    pr.max_rate,
    pr.created_at,
    pr.updated_at
  FROM public.pricing_rules pr
  LEFT JOIN public.properties p ON pr.property_id = p.id
  WHERE COALESCE(pr.is_deleted, false) = false
    AND ($2::uuid IS NULL OR pr.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR pr.property_id = $3::uuid)
    AND ($4::text IS NULL OR pr.rule_type = LOWER($4::text))
    AND ($5::boolean IS NULL OR pr.is_active = $5::boolean)
  ORDER BY pr.priority ASC, pr.created_at DESC
  LIMIT $1
  OFFSET $6
`;

export const PRICING_RULE_BY_ID_SQL = `
  SELECT
    pr.rule_id,
    pr.tenant_id,
    pr.property_id,
    p.property_name,
    pr.rule_name,
    pr.rule_description,
    pr.rule_type,
    pr.priority,
    pr.is_active,
    pr.effective_from,
    pr.effective_to,
    pr.applies_to_room_types,
    pr.applies_to_rate_plans,
    pr.condition_type,
    pr.condition_value,
    pr.condition_operator,
    pr.adjustment_type,
    pr.adjustment_value,
    pr.min_rate,
    pr.max_rate,
    pr.compound_with,
    pr.metadata,
    pr.created_at,
    pr.updated_at
  FROM public.pricing_rules pr
  LEFT JOIN public.properties p ON pr.property_id = p.id
  WHERE pr.rule_id = $1::uuid
    AND pr.tenant_id = $2::uuid
    AND COALESCE(pr.is_deleted, false) = false
`;

export const RATE_RECOMMENDATION_LIST_SQL = `
  SELECT
    rr.recommendation_id,
    rr.tenant_id,
    rr.property_id,
    p.property_name,
    rr.room_type_id,
    rt.type_name AS room_type_name,
    rr.rate_plan_id,
    rr.recommendation_date,
    rr.current_rate,
    rr.recommended_rate,
    rr.confidence_score,
    rr.recommendation_reason,
    rr.status,
    rr.applied_at,
    rr.created_at
  FROM public.rate_recommendations rr
  LEFT JOIN public.properties p ON rr.property_id = p.id
  LEFT JOIN public.room_types rt ON rr.room_type_id = rt.id
  WHERE COALESCE(rr.is_deleted, false) = false
    AND ($2::uuid IS NULL OR rr.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR rr.property_id = $3::uuid)
    AND ($4::text IS NULL OR rr.status = LOWER($4::text))
    AND ($5::date IS NULL OR rr.recommendation_date = $5::date)
  ORDER BY rr.recommendation_date DESC, rr.confidence_score DESC
  LIMIT $1
  OFFSET $6
`;

export const COMPETITOR_RATE_LIST_SQL = `
  SELECT
    cr.competitor_rate_id,
    cr.tenant_id,
    cr.property_id,
    p.property_name,
    cr.competitor_name,
    cr.competitor_property_name,
    cr.room_type_category,
    cr.rate_date,
    cr.rate_amount,
    cr.currency,
    cr.source,
    cr.collected_at,
    cr.created_at
  FROM public.competitor_rates cr
  LEFT JOIN public.properties p ON cr.property_id = p.id
  WHERE COALESCE(cr.is_deleted, false) = false
    AND ($2::uuid IS NULL OR cr.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR cr.property_id = $3::uuid)
    AND ($4::date IS NULL OR cr.rate_date = $4::date)
  ORDER BY cr.rate_date DESC, cr.competitor_name ASC
  LIMIT $1
  OFFSET $5
`;

export const DEMAND_CALENDAR_LIST_SQL = `
  SELECT
    dc.calendar_id,
    dc.tenant_id,
    dc.property_id,
    p.property_name,
    dc.calendar_date,
    dc.day_of_week,
    dc.demand_level,
    dc.occupancy_forecast,
    dc.booking_pace,
    dc.events,
    dc.notes,
    dc.created_at,
    dc.updated_at
  FROM public.demand_calendar dc
  LEFT JOIN public.properties p ON dc.property_id = p.id
  WHERE COALESCE(dc.is_deleted, false) = false
    AND ($2::uuid IS NULL OR dc.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR dc.property_id = $3::uuid)
    AND ($4::date IS NULL OR dc.calendar_date >= $4::date)
    AND ($5::date IS NULL OR dc.calendar_date <= $5::date)
  ORDER BY dc.calendar_date ASC
  LIMIT $1
  OFFSET $6
`;

// ── Pricing Rule Write Queries ──────────────────────

export const PRICING_RULE_INSERT_SQL = `
  INSERT INTO public.pricing_rules (
    tenant_id, property_id, rule_name, description, rule_type, rule_category,
    priority, is_active, effective_from, effective_until,
    applies_to_room_types, applies_to_rate_plans, applies_to_channels, applies_to_segments,
    applies_monday, applies_tuesday, applies_wednesday, applies_thursday,
    applies_friday, applies_saturday, applies_sunday,
    conditions, adjustment_type, adjustment_value,
    adjustment_cap_min, adjustment_cap_max, min_rate, max_rate,
    min_length_of_stay, max_length_of_stay,
    apply_closed_to_arrival, apply_closed_to_departure, apply_stop_sell,
    can_combine_with_other_rules, requires_approval,
    approval_status, metadata, created_by, updated_by
  ) VALUES (
    $1::uuid, $2::uuid, $3, $4, $5, $6,
    $7, $8, $9::date, $10::date,
    $11::uuid[], $12::uuid[], $13::varchar[], $14::varchar[],
    $15, $16, $17, $18,
    $19, $20, $21,
    $22::jsonb, $23, $24,
    $25, $26, $27, $28,
    $29, $30,
    $31, $32, $33,
    $34, $35,
    $36, $37::jsonb, $38::uuid, $38::uuid
  )
  RETURNING rule_id, created_at, updated_at
`;

export const PRICING_RULE_UPDATE_SQL = `
  UPDATE public.pricing_rules
  SET
    rule_name = COALESCE($3, rule_name),
    description = COALESCE($4, description),
    priority = COALESCE($5, priority),
    effective_from = COALESCE($6::date, effective_from),
    effective_until = COALESCE($7::date, effective_until),
    applies_to_room_types = COALESCE($8::uuid[], applies_to_room_types),
    applies_to_rate_plans = COALESCE($9::uuid[], applies_to_rate_plans),
    applies_to_channels = COALESCE($10::varchar[], applies_to_channels),
    applies_to_segments = COALESCE($11::varchar[], applies_to_segments),
    applies_monday = COALESCE($12, applies_monday),
    applies_tuesday = COALESCE($13, applies_tuesday),
    applies_wednesday = COALESCE($14, applies_wednesday),
    applies_thursday = COALESCE($15, applies_thursday),
    applies_friday = COALESCE($16, applies_friday),
    applies_saturday = COALESCE($17, applies_saturday),
    applies_sunday = COALESCE($18, applies_sunday),
    conditions = COALESCE($19::jsonb, conditions),
    adjustment_type = COALESCE($20, adjustment_type),
    adjustment_value = COALESCE($21, adjustment_value),
    adjustment_cap_min = COALESCE($22, adjustment_cap_min),
    adjustment_cap_max = COALESCE($23, adjustment_cap_max),
    min_rate = COALESCE($24, min_rate),
    max_rate = COALESCE($25, max_rate),
    min_length_of_stay = COALESCE($26, min_length_of_stay),
    max_length_of_stay = COALESCE($27, max_length_of_stay),
    apply_closed_to_arrival = COALESCE($28, apply_closed_to_arrival),
    apply_closed_to_departure = COALESCE($29, apply_closed_to_departure),
    apply_stop_sell = COALESCE($30, apply_stop_sell),
    can_combine_with_other_rules = COALESCE($31, can_combine_with_other_rules),
    requires_approval = COALESCE($32, requires_approval),
    last_modified_reason = COALESCE($33, last_modified_reason),
    metadata = COALESCE($34::jsonb, metadata),
    updated_by = $35::uuid,
    updated_at = CURRENT_TIMESTAMP
  WHERE rule_id = $1::uuid
    AND tenant_id = $2::uuid
    AND COALESCE(is_deleted, false) = false
  RETURNING rule_id, updated_at
`;

export const PRICING_RULE_ACTIVATE_SQL = `
  UPDATE public.pricing_rules
  SET is_active = true,
      is_paused = false,
      updated_by = $3::uuid,
      updated_at = CURRENT_TIMESTAMP
  WHERE rule_id = $1::uuid
    AND tenant_id = $2::uuid
    AND COALESCE(is_deleted, false) = false
  RETURNING rule_id, updated_at
`;

export const PRICING_RULE_DEACTIVATE_SQL = `
  UPDATE public.pricing_rules
  SET is_active = false,
      updated_by = $3::uuid,
      updated_at = CURRENT_TIMESTAMP
  WHERE rule_id = $1::uuid
    AND tenant_id = $2::uuid
    AND COALESCE(is_deleted, false) = false
  RETURNING rule_id, updated_at
`;

export const PRICING_RULE_SOFT_DELETE_SQL = `
  UPDATE public.pricing_rules
  SET is_deleted = true,
      is_active = false,
      deleted_at = CURRENT_TIMESTAMP,
      deleted_by = $3::uuid,
      updated_at = CURRENT_TIMESTAMP
  WHERE rule_id = $1::uuid
    AND tenant_id = $2::uuid
    AND COALESCE(is_deleted, false) = false
  RETURNING rule_id
`;

// ── Demand Calendar Write Queries ───────────────────

export const DEMAND_CALENDAR_UPSERT_SQL = `
  INSERT INTO public.demand_calendar (tenant_id, property_id, calendar_date, day_of_week, demand_level, notes, created_by, updated_by)
  VALUES ($1::uuid, $2::uuid, $3::date, EXTRACT(DOW FROM $3::date)::int, $4, $5, $6::uuid, $6::uuid)
  ON CONFLICT (property_id, calendar_date)
  DO UPDATE SET
    demand_level = EXCLUDED.demand_level,
    notes = COALESCE(EXCLUDED.notes, demand_calendar.notes),
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP
  RETURNING calendar_id
`;

// ── Competitor Rate Write Queries ───────────────────

export const COMPETITOR_RATE_INSERT_SQL = `
  INSERT INTO public.competitor_rates (
    tenant_id, property_id, competitor_name, competitor_property_name,
    room_type_category, rate_date, rate_amount, currency, source,
    includes_breakfast, includes_parking, includes_wifi, taxes_included,
    rooms_left, estimated_occupancy_percent,
    notes, collected_at, created_by, updated_by
  ) VALUES (
    $1::uuid, $2::uuid, $3, $4,
    $5, $6::date, $7, $8, $9,
    $10, $11, $12, $13,
    $14, $15,
    $16, CURRENT_TIMESTAMP, $17::uuid, $17::uuid
  )
  RETURNING competitor_rate_id, created_at
`;

// ── Rate Restriction Read Queries ───────────────────

export const RATE_RESTRICTION_LIST_SQL = `
  SELECT
    rr.restriction_id,
    rr.tenant_id,
    rr.property_id,
    p.property_name,
    rr.room_type_id,
    rt.type_name AS room_type_name,
    rr.rate_plan_id,
    rr.restriction_date,
    rr.restriction_type,
    rr.restriction_value,
    rr.is_active,
    rr.source,
    rr.reason,
    rr.created_at,
    rr.updated_at
  FROM public.rate_restrictions rr
  LEFT JOIN public.properties p ON rr.property_id = p.id
  LEFT JOIN public.room_types rt ON rr.room_type_id = rt.id
  WHERE COALESCE(rr.is_deleted, false) = false
    AND ($2::uuid IS NULL OR rr.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR rr.property_id = $3::uuid)
    AND ($4::uuid IS NULL OR rr.room_type_id = $4::uuid)
    AND ($5::uuid IS NULL OR rr.rate_plan_id = $5::uuid)
    AND ($6::text IS NULL OR rr.restriction_type = $6::text)
    AND ($7::date IS NULL OR rr.restriction_date >= $7::date)
    AND ($8::date IS NULL OR rr.restriction_date <= $8::date)
    AND ($9::boolean IS NULL OR rr.is_active = $9::boolean)
  ORDER BY rr.restriction_date ASC, rr.restriction_type ASC
  LIMIT $1
  OFFSET $10
`;

// ── Rate Restriction Write Queries ──────────────────

export const RATE_RESTRICTION_UPSERT_SQL = `
  INSERT INTO public.rate_restrictions (
    tenant_id, property_id, room_type_id, rate_plan_id,
    restriction_date, restriction_type, restriction_value,
    is_active, source, reason, metadata, created_by, updated_by
  ) VALUES (
    $1::uuid, $2::uuid, $3::uuid, $4::uuid,
    $5::date, $6, $7,
    $8, $9, $10, $11::jsonb, $12::uuid, $12::uuid
  )
  ON CONFLICT ON CONSTRAINT uq_rate_restrictions_composite
  DO UPDATE SET
    restriction_value = EXCLUDED.restriction_value,
    is_active = EXCLUDED.is_active,
    source = EXCLUDED.source,
    reason = COALESCE(EXCLUDED.reason, rate_restrictions.reason),
    metadata = COALESCE(EXCLUDED.metadata, rate_restrictions.metadata),
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP,
    is_deleted = false,
    deleted_at = NULL,
    deleted_by = NULL
  RETURNING restriction_id, created_at
`;

export const RATE_RESTRICTION_REMOVE_SQL = `
  UPDATE public.rate_restrictions
  SET is_deleted = true,
      is_active = false,
      deleted_at = CURRENT_TIMESTAMP,
      deleted_by = $5::uuid,
      updated_at = CURRENT_TIMESTAMP
  WHERE tenant_id = $1::uuid
    AND property_id = $2::uuid
    AND restriction_date = $3::date
    AND restriction_type = $4
    AND ($6::uuid IS NULL OR room_type_id = $6::uuid)
    AND ($7::uuid IS NULL OR rate_plan_id = $7::uuid)
    AND COALESCE(is_deleted, false) = false
  RETURNING restriction_id
`;

// ── Hurdle Rate Read Queries ────────────────────────

export const HURDLE_RATE_LIST_SQL = `
  SELECT
    hr.hurdle_rate_id,
    hr.tenant_id,
    hr.property_id,
    p.property_name,
    hr.room_type_id,
    rt.type_name AS room_type_name,
    hr.hurdle_date,
    hr.hurdle_rate,
    hr.currency,
    hr.segment,
    hr.source,
    hr.displacement_analysis,
    hr.confidence_score,
    hr.is_active,
    hr.notes,
    hr.created_at,
    hr.updated_at
  FROM public.hurdle_rates hr
  LEFT JOIN public.properties p ON hr.property_id = p.id
  LEFT JOIN public.room_types rt ON hr.room_type_id = rt.id
  WHERE COALESCE(hr.is_deleted, false) = false
    AND ($2::uuid IS NULL OR hr.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR hr.property_id = $3::uuid)
    AND ($4::uuid IS NULL OR hr.room_type_id = $4::uuid)
    AND ($5::text IS NULL OR hr.segment = $5::text)
    AND ($6::date IS NULL OR hr.hurdle_date >= $6::date)
    AND ($7::date IS NULL OR hr.hurdle_date <= $7::date)
    AND ($8::text IS NULL OR hr.source = $8::text)
  ORDER BY hr.hurdle_date ASC, hr.room_type_id ASC
  LIMIT $1
  OFFSET $9
`;

// ── Hurdle Rate Write Queries ───────────────────────

export const HURDLE_RATE_UPSERT_SQL = `
  INSERT INTO public.hurdle_rates (
    tenant_id, property_id, room_type_id,
    hurdle_date, hurdle_rate, currency, segment,
    source, displacement_analysis, confidence_score,
    is_active, notes, metadata, created_by, updated_by
  ) VALUES (
    $1::uuid, $2::uuid, $3::uuid,
    $4::date, $5, $6, $7,
    $8, $9::jsonb, $10,
    $11, $12, $13::jsonb, $14::uuid, $14::uuid
  )
  ON CONFLICT ON CONSTRAINT uq_hurdle_rates_composite
  DO UPDATE SET
    hurdle_rate = EXCLUDED.hurdle_rate,
    currency = EXCLUDED.currency,
    source = EXCLUDED.source,
    displacement_analysis = COALESCE(EXCLUDED.displacement_analysis, hurdle_rates.displacement_analysis),
    confidence_score = EXCLUDED.confidence_score,
    is_active = EXCLUDED.is_active,
    notes = COALESCE(EXCLUDED.notes, hurdle_rates.notes),
    metadata = COALESCE(EXCLUDED.metadata, hurdle_rates.metadata),
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP,
    is_deleted = false,
    deleted_at = NULL,
    deleted_by = NULL
  RETURNING hurdle_rate_id, created_at
`;

// ── Rate Shopping Comparison Query (R15) ────────────

/**
 * Compare own rates vs competitor rates across a date range.
 * Joins the latest rate calendar entry (own rate) with competitor_rates
 * grouped by date and competitor.
 *
 * Params: $1 tenant_id, $2 property_id, $3 start_date, $4 end_date,
 *         $5 competitor_name (optional), $6 limit, $7 offset
 */
export const RATE_SHOPPING_COMPARISON_SQL = `
  WITH own_rates AS (
    SELECT
      rc.rate_date,
      ROUND(AVG(rc.rate_amount)::numeric, 2) AS own_rate
    FROM public.rate_calendar rc
    WHERE rc.tenant_id = $1::uuid
      AND rc.property_id = $2::uuid
      AND rc.rate_date BETWEEN $3::date AND $4::date
      AND COALESCE(rc.is_deleted, false) = false
    GROUP BY rc.rate_date
  )
  SELECT
    cr.rate_date,
    owr.own_rate,
    cr.competitor_name,
    cr.rate_amount AS competitor_rate,
    ROUND((owr.own_rate - cr.rate_amount)::numeric, 2) AS rate_difference,
    CASE WHEN cr.rate_amount > 0
      THEN ROUND(((owr.own_rate - cr.rate_amount) / cr.rate_amount * 100)::numeric, 1)
      ELSE NULL
    END AS rate_difference_pct,
    cr.rooms_left AS competitor_rooms_left,
    cr.estimated_occupancy_percent AS competitor_occupancy_pct,
    cr.source,
    cr.collected_at
  FROM public.competitor_rates cr
  LEFT JOIN own_rates owr ON owr.rate_date = cr.rate_date
  WHERE cr.tenant_id = $1::uuid
    AND cr.property_id = $2::uuid
    AND cr.rate_date BETWEEN $3::date AND $4::date
    AND COALESCE(cr.is_deleted, false) = false
    AND ($5::text IS NULL OR cr.competitor_name = $5::text)
  ORDER BY cr.rate_date ASC, cr.competitor_name ASC
  LIMIT $6
  OFFSET $7
`;

// ── Competitive Response Rule Queries (R16) ─────────

/**
 * List competitive response rules.
 * These are pricing_rules with rule_type = 'competitor_based',
 * enriched with the competitor-specific fields from conditions JSONB.
 *
 * Params: $1 limit, $2 tenant_id, $3 property_id (optional), $4 is_active (optional), $5 offset
 */
export const COMPETITIVE_RESPONSE_RULE_LIST_SQL = `
  SELECT
    pr.rule_id,
    pr.tenant_id,
    pr.property_id,
    p.property_name,
    pr.rule_name,
    pr.rule_type,
    pr.conditions->>'track_competitor' AS track_competitor,
    pr.conditions->>'response_strategy' AS response_strategy,
    COALESCE((pr.conditions->>'response_value')::numeric, 0) AS response_value,
    COALESCE(pr.min_rate, 0) AS min_rate,
    COALESCE(pr.max_rate, 0) AS max_rate,
    COALESCE((pr.metadata->>'auto_apply')::boolean, false) AS auto_apply,
    COALESCE((pr.conditions->>'trigger_threshold_percent')::numeric, 5) AS trigger_threshold_percent,
    pr.is_active,
    pr.description AS notes,
    pr.created_at,
    pr.updated_at
  FROM public.pricing_rules pr
  LEFT JOIN public.properties p ON pr.property_id = p.id
  WHERE pr.rule_type = 'competitor_based'
    AND COALESCE(pr.is_deleted, false) = false
    AND ($2::uuid IS NULL OR pr.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR pr.property_id = $3::uuid)
    AND ($4::boolean IS NULL OR pr.is_active = $4::boolean)
  ORDER BY pr.priority ASC, pr.created_at DESC
  LIMIT $1
  OFFSET $5
`;

/**
 * Insert or update a competitive response rule as a pricing_rule
 * with rule_type = 'competitor_based'.
 *
 * Params: $1 tenant_id, $2 property_id, $3 rule_name,
 *         $4 conditions (jsonb), $5 min_rate, $6 max_rate,
 *         $7 is_active, $8 description, $9 metadata (jsonb),
 *         $10 room_type_id (optional), $11 created_by
 */
export const COMPETITIVE_RESPONSE_RULE_UPSERT_SQL = `
  INSERT INTO public.pricing_rules (
    tenant_id, property_id, rule_name, description,
    rule_type, rule_category, priority,
    is_active, conditions, min_rate, max_rate,
    applies_to_room_types, metadata,
    created_by, updated_by
  ) VALUES (
    $1::uuid, $2::uuid, $3, $8,
    'competitor_based', 'competitive', 100,
    $7, $4::jsonb, $5, $6,
    CASE WHEN $10::uuid IS NOT NULL THEN ARRAY[$10::uuid] ELSE NULL END,
    $9::jsonb,
    $11::uuid, $11::uuid
  )
  RETURNING rule_id, created_at
`;
