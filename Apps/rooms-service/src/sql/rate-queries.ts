/**
 * DEV DOC
 * Module: sql/rate-queries.ts
 * Purpose: SQL queries for rate CRUD operations
 * Ownership: rooms-service
 */

export const RATE_LIST_SQL = `
  SELECT
    r.id,
    r.tenant_id,
    r.property_id,
    r.room_type_id,
    r.rate_name,
    r.rate_code,
    r.description,
    r.rate_type,
    r.strategy,
    r.priority,
    r.base_rate,
    r.currency,
    r.single_occupancy_rate,
    r.double_occupancy_rate,
    r.extra_person_rate,
    r.extra_child_rate,
    r.valid_from,
    r.valid_until,
    r.advance_booking_days_min,
    r.advance_booking_days_max,
    r.min_length_of_stay,
    r.max_length_of_stay,
    r.closed_to_arrival,
    r.closed_to_departure,
    r.meal_plan,
    r.meal_plan_cost,
    r.cancellation_policy,
    r.modifiers,
    r.channels,
    r.customer_segments,
    r.tax_inclusive,
    r.tax_rate,
    r.status,
    r.display_order,
    r.metadata,
    r.created_at,
    r.updated_at,
    r.version
  FROM public.rates r
  WHERE COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
    AND r.tenant_id = $1::uuid
    AND ($2::uuid IS NULL OR r.property_id = $2::uuid)
    AND ($3::uuid IS NULL OR r.room_type_id = $3::uuid)
    AND ($4::text IS NULL OR r.status::text = $4)
    AND ($5::text IS NULL OR r.rate_type::text = $5)
    AND (
      $6::text IS NULL
      OR r.rate_name ILIKE $6
      OR r.rate_code ILIKE $6
    )
  ORDER BY r.priority ASC, r.rate_name ASC
  LIMIT $7
  OFFSET $8
`;

export const RATE_GET_BY_ID_SQL = `
  SELECT
    r.id,
    r.tenant_id,
    r.property_id,
    r.room_type_id,
    r.rate_name,
    r.rate_code,
    r.description,
    r.rate_type,
    r.strategy,
    r.priority,
    r.base_rate,
    r.currency,
    r.single_occupancy_rate,
    r.double_occupancy_rate,
    r.extra_person_rate,
    r.extra_child_rate,
    r.valid_from,
    r.valid_until,
    r.advance_booking_days_min,
    r.advance_booking_days_max,
    r.min_length_of_stay,
    r.max_length_of_stay,
    r.closed_to_arrival,
    r.closed_to_departure,
    r.meal_plan,
    r.meal_plan_cost,
    r.cancellation_policy,
    r.modifiers,
    r.channels,
    r.customer_segments,
    r.tax_inclusive,
    r.tax_rate,
    r.status,
    r.display_order,
    r.metadata,
    r.created_at,
    r.updated_at,
    r.version
  FROM public.rates r
  WHERE r.id = $1::uuid
    AND r.tenant_id = $2::uuid
    AND COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
`;

export const RATE_CREATE_SQL = `
  WITH inserted AS (
    INSERT INTO public.rates (
      tenant_id,
      property_id,
      room_type_id,
      rate_name,
      rate_code,
      description,
      rate_type,
      strategy,
      priority,
      base_rate,
      currency,
      single_occupancy_rate,
      double_occupancy_rate,
      extra_person_rate,
      extra_child_rate,
      valid_from,
      valid_until,
      advance_booking_days_min,
      advance_booking_days_max,
      min_length_of_stay,
      max_length_of_stay,
      closed_to_arrival,
      closed_to_departure,
      meal_plan,
      meal_plan_cost,
      cancellation_policy,
      modifiers,
      channels,
      customer_segments,
      tax_inclusive,
      tax_rate,
      status,
      display_order,
      metadata,
      created_by,
      updated_by
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      COALESCE($7, 'BAR')::rate_type,
      COALESCE($8, 'FIXED')::rate_strategy,
      COALESCE($9, 100),
      $10,
      COALESCE($11, 'USD'),
      $12,
      $13,
      $14,
      $15,
      $16,
      $17,
      COALESCE($18, 0),
      $19,
      COALESCE($20, 1),
      $21,
      COALESCE($22, false),
      COALESCE($23, false),
      $24,
      COALESCE($25, 0),
      COALESCE($26, '{"hours": 24, "penalty": 0, "type": "flexible"}'::jsonb),
      COALESCE($27, '{"weekendSurcharge": 0, "seasonalModifier": 0, "discounts": []}'::jsonb),
      COALESCE($28, '["direct", "ota", "phone", "walk_in"]'::jsonb),
      COALESCE($29, '["all"]'::jsonb),
      COALESCE($30, false),
      COALESCE($31, 0),
      COALESCE($32, 'ACTIVE')::rate_status,
      COALESCE($33, 0),
      COALESCE($34, '{}'::jsonb),
      $35,
      $35
    )
    RETURNING *
  )
  SELECT
    i.id,
    i.tenant_id,
    i.property_id,
    i.room_type_id,
    i.rate_name,
    i.rate_code,
    i.description,
    i.rate_type,
    i.strategy,
    i.priority,
    i.base_rate,
    i.currency,
    i.single_occupancy_rate,
    i.double_occupancy_rate,
    i.extra_person_rate,
    i.extra_child_rate,
    i.valid_from,
    i.valid_until,
    i.advance_booking_days_min,
    i.advance_booking_days_max,
    i.min_length_of_stay,
    i.max_length_of_stay,
    i.closed_to_arrival,
    i.closed_to_departure,
    i.meal_plan,
    i.meal_plan_cost,
    i.cancellation_policy,
    i.modifiers,
    i.channels,
    i.customer_segments,
    i.tax_inclusive,
    i.tax_rate,
    i.status,
    i.display_order,
    i.metadata,
    i.created_at,
    i.updated_at,
    i.version
  FROM inserted i
`;

const _RATE_UPDATE_SQL = `
  WITH updated AS (
    UPDATE public.rates r
    SET
      property_id = COALESCE($3, r.property_id),
      room_type_id = COALESCE($4, r.room_type_id),
      rate_name = COALESCE($5, r.rate_name),
      rate_code = COALESCE($6, r.rate_code),
      description = COALESCE($7, r.description),
      rate_type = COALESCE($8, r.rate_type),
      strategy = COALESCE($9, r.strategy),
      priority = COALESCE($10, r.priority),
      base_rate = COALESCE($11, r.base_rate),
      currency = COALESCE($12, r.currency),
      single_occupancy_rate = COALESCE($13, r.single_occupancy_rate),
      double_occupancy_rate = COALESCE($14, r.double_occupancy_rate),
      extra_person_rate = COALESCE($15, r.extra_person_rate),
      extra_child_rate = COALESCE($16, r.extra_child_rate),
      valid_from = COALESCE($17, r.valid_from),
      valid_until = COALESCE($18, r.valid_until),
      advance_booking_days_min = COALESCE($19, r.advance_booking_days_min),
      advance_booking_days_max = COALESCE($20, r.advance_booking_days_max),
      min_length_of_stay = COALESCE($21, r.min_length_of_stay),
      max_length_of_stay = COALESCE($22, r.max_length_of_stay),
      closed_to_arrival = COALESCE($23, r.closed_to_arrival),
      closed_to_departure = COALESCE($24, r.closed_to_departure),
      meal_plan = COALESCE($25, r.meal_plan),
      meal_plan_cost = COALESCE($26, r.meal_plan_cost),
      cancellation_policy = COALESCE($27, r.cancellation_policy),
      modifiers = COALESCE($28, r.modifiers),
      channels = COALESCE($29, r.channels),
      customer_segments = COALESCE($30, r.customer_segments),
      tax_inclusive = COALESCE($31, r.tax_inclusive),
      tax_rate = COALESCE($32, r.tax_rate),
      status = COALESCE($33, r.status),
      display_order = COALESCE($34, r.display_order),
      metadata = COALESCE($35, r.metadata),
      updated_at = CURRENT_TIMESTAMP,
      updated_by = COALESCE($36, r.updated_by),
      version = r.version + 1
    WHERE r.id = $1::uuid
      AND r.tenant_id = $2::uuid
      AND COALESCE(r.is_deleted, false) = false
      AND r.deleted_at IS NULL
    RETURNING *
  )
  SELECT
    u.id,
    u.tenant_id,
    u.property_id,
    u.room_type_id,
    u.rate_name,
    u.rate_code,
    u.description,
    u.rate_type,
    u.strategy,
    u.priority,
    u.base_rate,
    u.currency,
    u.single_occupancy_rate,
    u.double_occupancy_rate,
    u.extra_person_rate,
    u.extra_child_rate,
    u.valid_from,
    u.valid_until,
    u.advance_booking_days_min,
    u.advance_booking_days_max,
    u.min_length_of_stay,
    u.max_length_of_stay,
    u.closed_to_arrival,
    u.closed_to_departure,
    u.meal_plan,
    u.meal_plan_cost,
    u.cancellation_policy,
    u.modifiers,
    u.channels,
    u.customer_segments,
    u.tax_inclusive,
    u.tax_rate,
    u.status,
    u.display_order,
    u.metadata,
    u.created_at,
    u.updated_at,
    u.version
  FROM updated u
`;

export const RATE_DELETE_SQL = `
  UPDATE public.rates r
  SET
    is_deleted = true,
    deleted_at = CURRENT_TIMESTAMP,
    deleted_by = COALESCE($3, r.deleted_by),
    updated_at = CURRENT_TIMESTAMP,
    updated_by = COALESCE($3, r.updated_by),
    version = r.version + 1
  WHERE r.id = $1::uuid
    AND r.tenant_id = $2::uuid
    AND COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
  RETURNING r.id
`;
