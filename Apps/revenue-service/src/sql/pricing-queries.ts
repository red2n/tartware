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
