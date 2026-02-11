// =====================================================
// MEETING ROOM QUERIES
// =====================================================

export const MEETING_ROOM_LIST_SQL = `
  SELECT
    m.room_id,
    m.tenant_id,
    m.property_id,
    p.property_name,
    m.room_code,
    m.room_name,
    m.room_type,
    m.room_status,
    m.building,
    m.floor,
    m.location_description,
    m.max_capacity,
    m.theater_capacity,
    m.classroom_capacity,
    m.banquet_capacity,
    m.reception_capacity,
    m.u_shape_capacity,
    m.boardroom_capacity,
    m.area_sqm,
    m.area_sqft,
    m.length_meters,
    m.width_meters,
    m.ceiling_height_meters,
    m.has_natural_light,
    m.has_audio_visual,
    m.has_video_conferencing,
    m.has_wifi,
    m.has_stage,
    m.has_dance_floor,
    m.wheelchair_accessible,
    m.default_setup,
    m.setup_time_minutes,
    m.teardown_time_minutes,
    m.turnover_time_minutes,
    m.hourly_rate,
    m.half_day_rate,
    m.full_day_rate,
    m.minimum_rental_hours,
    m.currency_code,
    m.operating_hours_start,
    m.operating_hours_end,
    m.catering_required,
    m.in_house_catering_available,
    m.external_catering_allowed,
    m.primary_photo_url,
    m.floor_plan_url,
    m.virtual_tour_url,
    m.is_active,
    m.requires_approval,
    m.created_at,
    m.updated_at
  FROM public.meeting_rooms m
  LEFT JOIN public.properties p ON m.property_id = p.id
  WHERE COALESCE(m.is_deleted, false) = false
    AND ($2::uuid IS NULL OR m.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR m.property_id = $3::uuid)
    AND ($4::text IS NULL OR m.room_type = UPPER($4::text))
    AND ($5::text IS NULL OR m.room_status = UPPER($5::text))
    AND ($6::boolean IS NULL OR m.is_active = $6::boolean)
    AND ($7::integer IS NULL OR m.max_capacity >= $7::integer)
  ORDER BY m.room_name ASC
  LIMIT $1
  OFFSET $8
`;

export const MEETING_ROOM_BY_ID_SQL = `
  SELECT
    m.room_id,
    m.tenant_id,
    m.property_id,
    p.property_name,
    m.room_code,
    m.room_name,
    m.room_type,
    m.room_status,
    m.building,
    m.floor,
    m.location_description,
    m.max_capacity,
    m.theater_capacity,
    m.classroom_capacity,
    m.banquet_capacity,
    m.reception_capacity,
    m.u_shape_capacity,
    m.hollow_square_capacity,
    m.boardroom_capacity,
    m.area_sqm,
    m.area_sqft,
    m.length_meters,
    m.width_meters,
    m.height_meters,
    m.ceiling_height_meters,
    m.length_feet,
    m.width_feet,
    m.ceiling_height_feet,
    m.has_natural_light,
    m.has_windows,
    m.has_stage,
    m.has_dance_floor,
    m.has_audio_visual,
    m.has_projector,
    m.has_screen,
    m.has_microphones,
    m.has_sound_system,
    m.has_wifi,
    m.has_video_conferencing,
    m.has_whiteboard,
    m.has_flipchart,
    m.has_podium,
    m.has_climate_control,
    m.has_lighting_control,
    m.has_soundproofing,
    m.wheelchair_accessible,
    m.default_setup,
    m.setup_time_minutes,
    m.teardown_time_minutes,
    m.turnover_time_minutes,
    m.hourly_rate,
    m.half_day_rate,
    m.full_day_rate,
    m.minimum_rental_hours,
    m.overtime_rate_per_hour,
    m.currency_code,
    m.operating_hours_start,
    m.operating_hours_end,
    m.catering_required,
    m.in_house_catering_available,
    m.external_catering_allowed,
    m.kitchen_access,
    m.bar_service_available,
    m.primary_photo_url,
    m.photo_gallery,
    m.floor_plan_url,
    m.virtual_tour_url,
    m.marketing_description,
    m.is_active,
    m.requires_approval,
    m.metadata,
    m.created_at,
    m.created_by,
    m.updated_at,
    m.updated_by,
    m.version
  FROM public.meeting_rooms m
  LEFT JOIN public.properties p ON m.property_id = p.id
  WHERE m.room_id = $1
    AND m.tenant_id = $2
    AND COALESCE(m.is_deleted, false) = false
`;

// =====================================================
// EVENT BOOKING QUERIES
// =====================================================

export const EVENT_BOOKING_LIST_SQL = `
  SELECT
    e.event_id,
    e.tenant_id,
    e.property_id,
    p.property_name,
    e.event_number,
    e.event_name,
    e.event_type,
    e.meeting_room_id,
    m.room_name AS meeting_room_name,
    e.event_date,
    e.start_time,
    e.end_time,
    e.setup_start_time,
    e.actual_start_time,
    e.actual_end_time,
    e.organizer_name,
    e.organizer_company,
    e.organizer_email,
    e.organizer_phone,
    e.guest_id,
    e.reservation_id,
    e.company_id,
    e.expected_attendees,
    e.confirmed_attendees,
    e.actual_attendees,
    e.guarantee_number,
    e.setup_type,
    e.catering_required,
    e.audio_visual_needed,
    e.booking_status,
    e.payment_status,
    e.booked_date,
    e.confirmed_date,
    e.beo_due_date,
    e.final_count_due_date,
    e.rental_rate,
    e.estimated_total,
    e.actual_total,
    e.deposit_required,
    e.deposit_paid,
    e.currency_code,
    e.contract_signed,
    e.beo_pdf_url,
    e.post_event_rating,
    e.attendee_satisfaction_score,
    e.is_recurring,
    e.followup_required,
    e.created_at,
    e.updated_at
  FROM public.event_bookings e
  LEFT JOIN public.properties p ON e.property_id = p.id
  LEFT JOIN public.meeting_rooms m ON e.meeting_room_id = m.room_id
  WHERE COALESCE(e.is_deleted, false) = false
    AND ($2::uuid IS NULL OR e.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR e.property_id = $3::uuid)
    AND ($4::text IS NULL OR e.event_type = UPPER($4::text))
    AND ($5::text IS NULL OR e.booking_status = UPPER($5::text))
    AND ($6::date IS NULL OR e.event_date >= $6::date)
    AND ($7::date IS NULL OR e.event_date <= $7::date)
    AND ($8::uuid IS NULL OR e.meeting_room_id = $8::uuid)
  ORDER BY e.event_date ASC, e.start_time ASC
  LIMIT $1
  OFFSET $9
`;

export const EVENT_BOOKING_BY_ID_SQL = `
  SELECT
    e.event_id,
    e.tenant_id,
    e.property_id,
    p.property_name,
    e.event_number,
    e.event_name,
    e.event_type,
    e.meeting_room_id,
    m.room_name AS meeting_room_name,
    e.event_date,
    e.start_time,
    e.end_time,
    e.setup_start_time,
    e.actual_start_time,
    e.actual_end_time,
    e.teardown_end_time,
    e.organizer_name,
    e.organizer_company,
    e.organizer_email,
    e.organizer_phone,
    e.contact_person,
    e.contact_email,
    e.contact_phone,
    e.guest_id,
    e.reservation_id,
    e.company_id,
    e.group_booking_id,
    e.expected_attendees,
    e.confirmed_attendees,
    e.actual_attendees,
    e.guarantee_number,
    e.max_capacity,
    e.setup_type,
    e.setup_details,
    e.special_requests,
    e.setup_diagram_url,
    e.catering_required,
    e.catering_service_type,
    e.audio_visual_needed,
    e.lighting_requirements,
    e.booking_status,
    e.confirmation_status,
    e.payment_status,
    e.booked_date,
    e.confirmed_date,
    e.beo_due_date,
    e.final_count_due_date,
    e.cancellation_deadline,
    e.rental_rate,
    e.setup_fee,
    e.equipment_rental_fee,
    e.av_equipment_fee,
    e.estimated_food_beverage,
    e.estimated_total,
    e.actual_total,
    e.currency_code,
    e.deposit_required,
    e.deposit_paid,
    e.deposit_due_date,
    e.contract_signed,
    e.contract_url,
    e.beo_pdf_url,
    e.post_event_rating,
    e.attendee_satisfaction_score,
    e.post_event_feedback,
    e.is_recurring,
    e.recurring_pattern,
    e.followup_required,
    e.internal_notes,
    e.metadata,
    e.created_at,
    e.created_by,
    e.updated_at,
    e.updated_by,
    e.version
  FROM public.event_bookings e
  LEFT JOIN public.properties p ON e.property_id = p.id
  LEFT JOIN public.meeting_rooms m ON e.meeting_room_id = m.room_id
  WHERE e.event_id = $1
    AND e.tenant_id = $2
    AND COALESCE(e.is_deleted, false) = false
`;
