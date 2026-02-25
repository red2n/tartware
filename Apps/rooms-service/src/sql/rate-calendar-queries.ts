/**
 * DEV DOC
 * Module: sql/rate-calendar-queries.ts
 * Purpose: SQL queries for rate calendar CRUD
 * Ownership: rooms-service
 */

export const RATE_CALENDAR_LIST_SQL = `
  SELECT
    rc.id,
    rc.tenant_id,
    rc.property_id,
    rc.room_type_id,
    rc.rate_id,
    rc.stay_date,
    rc.rate_amount,
    rc.currency,
    rc.single_rate,
    rc.double_rate,
    rc.extra_person,
    rc.extra_child,
    rc.status,
    rc.closed_to_arrival,
    rc.closed_to_departure,
    rc.min_length_of_stay,
    rc.max_length_of_stay,
    rc.min_advance_days,
    rc.max_advance_days,
    rc.rooms_to_sell,
    rc.rooms_sold,
    rc.source
  FROM public.rate_calendar rc
  WHERE rc.tenant_id    = $1
    AND rc.property_id  = $2
    AND rc.stay_date   >= $3
    AND rc.stay_date   <= $4
`;

export const RATE_CALENDAR_UPSERT_SQL = `
  INSERT INTO public.rate_calendar (
    tenant_id, property_id, room_type_id, rate_id,
    stay_date, rate_amount, currency,
    single_rate, double_rate, extra_person, extra_child,
    status, closed_to_arrival, closed_to_departure,
    min_length_of_stay, max_length_of_stay,
    source, created_by
  ) VALUES (
    $1, $2, $3, $4,
    $5, $6, $7,
    $8, $9, $10, $11,
    $12, $13, $14,
    $15, $16,
    $17, $18
  )
  ON CONFLICT (property_id, room_type_id, rate_id, stay_date)
  DO UPDATE SET
    rate_amount         = EXCLUDED.rate_amount,
    currency            = EXCLUDED.currency,
    single_rate         = EXCLUDED.single_rate,
    double_rate         = EXCLUDED.double_rate,
    extra_person        = EXCLUDED.extra_person,
    extra_child         = EXCLUDED.extra_child,
    status              = EXCLUDED.status,
    closed_to_arrival   = EXCLUDED.closed_to_arrival,
    closed_to_departure = EXCLUDED.closed_to_departure,
    min_length_of_stay  = EXCLUDED.min_length_of_stay,
    max_length_of_stay  = EXCLUDED.max_length_of_stay,
    source              = EXCLUDED.source,
    updated_at          = CURRENT_TIMESTAMP,
    updated_by          = EXCLUDED.created_by
  RETURNING
    id, tenant_id, property_id, room_type_id, rate_id,
    stay_date, rate_amount, currency,
    single_rate, double_rate, extra_person, extra_child,
    status, closed_to_arrival, closed_to_departure,
    min_length_of_stay, max_length_of_stay,
    min_advance_days, max_advance_days,
    rooms_to_sell, rooms_sold, source
`;
