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

// Note: Rate updates use a dynamic query builder in rate-service.ts
// to support partial updates (distinguishing undefined vs null).

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
