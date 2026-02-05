// =====================================================
// ALLOTMENT QUERIES
// =====================================================

export const ALLOTMENT_LIST_SQL = `
  SELECT
    a.allotment_id,
    a.tenant_id,
    a.property_id,
    p.property_name,
    a.allotment_code,
    a.allotment_name,
    a.allotment_type,
    a.allotment_status,
    a.start_date,
    a.end_date,
    a.cutoff_date,
    a.room_type_id,
    a.total_rooms_blocked,
    a.total_room_nights,
    a.rooms_per_night,
    a.rooms_picked_up,
    a.rooms_available,
    a.pickup_percentage,
    a.rate_type,
    a.contracted_rate,
    a.total_expected_revenue,
    a.actual_revenue,
    a.currency_code,
    a.account_name,
    a.account_type,
    a.billing_type,
    a.contact_name,
    a.contact_email,
    a.deposit_required,
    a.attrition_clause,
    a.attrition_percentage,
    a.guaranteed_rooms,
    a.is_vip,
    a.priority_level,
    a.created_at,
    a.updated_at
  FROM public.allotments a
  LEFT JOIN public.properties p ON a.property_id = p.id
  WHERE COALESCE(a.is_deleted, false) = false
    AND ($2::uuid IS NULL OR a.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR a.property_id = $3::uuid)
    AND ($4::text IS NULL OR a.allotment_status = UPPER($4::text))
    AND ($5::text IS NULL OR a.allotment_type = UPPER($5::text))
    AND ($6::date IS NULL OR a.start_date >= $6::date)
    AND ($7::date IS NULL OR a.end_date <= $7::date)
  ORDER BY a.start_date ASC, a.allotment_name ASC
  LIMIT $1
`;

export const ALLOTMENT_BY_ID_SQL = `
  SELECT
    a.allotment_id,
    a.tenant_id,
    a.property_id,
    p.property_name,
    a.allotment_code,
    a.allotment_name,
    a.allotment_type,
    a.allotment_status,
    a.start_date,
    a.end_date,
    a.cutoff_date,
    a.cutoff_days_prior,
    a.room_type_id,
    a.total_rooms_blocked,
    a.total_room_nights,
    a.rooms_per_night,
    a.rooms_picked_up,
    a.rooms_available,
    a.pickup_percentage,
    a.rate_type,
    a.contracted_rate,
    a.min_rate,
    a.max_rate,
    a.total_expected_revenue,
    a.actual_revenue,
    a.currency_code,
    a.account_name,
    a.account_type,
    a.billing_type,
    a.master_folio_id,
    a.contact_name,
    a.contact_title,
    a.contact_email,
    a.contact_phone,
    a.contact_company,
    a.booking_source_id,
    a.booking_reference,
    a.channel,
    a.market_segment_id,
    a.deposit_required,
    a.deposit_amount,
    a.deposit_percentage,
    a.deposit_due_date,
    a.cancellation_policy,
    a.cancellation_deadline,
    a.cancellation_fee_amount,
    a.attrition_clause,
    a.attrition_percentage,
    a.attrition_penalty,
    a.guaranteed_rooms,
    a.on_hold_rooms,
    a.elastic_limit,
    a.rate_details,
    a.special_requests,
    a.amenities_included,
    a.setup_requirements,
    a.commission_percentage,
    a.commission_amount,
    a.commissionable_amount,
    a.confirmed_at,
    a.confirmed_by,
    a.activated_at,
    a.completed_at,
    a.cancelled_at,
    a.cancelled_by,
    a.cancellation_reason,
    a.account_manager_id,
    a.operations_manager_id,
    a.is_vip,
    a.priority_level,
    a.notes,
    a.internal_notes,
    a.metadata,
    a.created_at,
    a.created_by,
    a.updated_at,
    a.updated_by
  FROM public.allotments a
  LEFT JOIN public.properties p ON a.property_id = p.id
  WHERE a.allotment_id = $1
    AND a.tenant_id = $2
    AND COALESCE(a.is_deleted, false) = false
`;

// =====================================================
// BOOKING SOURCE QUERIES
// =====================================================

export const BOOKING_SOURCE_LIST_SQL = `
  SELECT
    b.source_id,
    b.tenant_id,
    b.property_id,
    p.property_name,
    b.source_code,
    b.source_name,
    b.source_type,
    b.category,
    b.is_active,
    b.is_bookable,
    b.channel_name,
    b.channel_website,
    b.commission_type,
    b.commission_percentage,
    b.commission_fixed_amount,
    b.total_bookings,
    b.total_revenue,
    b.total_room_nights,
    b.average_booking_value,
    b.conversion_rate,
    b.cancellation_rate,
    b.ranking,
    b.is_preferred,
    b.is_featured,
    b.has_integration,
    b.integration_type,
    b.last_sync_at,
    b.display_name,
    b.logo_url,
    b.color_code
  FROM public.booking_sources b
  LEFT JOIN public.properties p ON b.property_id = p.id
  WHERE COALESCE(b.is_deleted, false) = false
    AND ($2::uuid IS NULL OR b.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR b.property_id = $3::uuid)
    AND ($4::text IS NULL OR b.source_type = UPPER($4::text))
    AND ($5::boolean IS NULL OR b.is_active = $5::boolean)
    AND ($6::boolean IS NULL OR b.has_integration = $6::boolean)
  ORDER BY COALESCE(b.ranking, 999) ASC, b.source_name ASC
  LIMIT $1
`;

export const BOOKING_SOURCE_BY_ID_SQL = `
  SELECT
    b.source_id,
    b.tenant_id,
    b.property_id,
    p.property_name,
    b.source_code,
    b.source_name,
    b.source_type,
    b.category,
    b.sub_category,
    b.is_active,
    b.is_bookable,
    b.channel_name,
    b.channel_website,
    b.channel_manager,
    b.commission_type,
    b.commission_percentage,
    b.commission_fixed_amount,
    b.commission_notes,
    b.total_bookings,
    b.total_revenue,
    b.total_commission_paid,
    b.total_room_nights,
    b.average_booking_value,
    b.conversion_rate,
    b.cancellation_rate,
    b.average_lead_time_days,
    b.average_length_of_stay,
    b.ranking,
    b.is_preferred,
    b.is_featured,
    b.has_integration,
    b.integration_type,
    b.last_sync_at,
    b.sync_frequency_minutes,
    b.contact_name,
    b.contact_email,
    b.contact_phone,
    b.account_manager_name,
    b.account_manager_email,
    b.billing_cycle,
    b.payment_terms,
    b.invoice_email,
    b.tax_id,
    b.contract_start_date,
    b.contract_end_date,
    b.contract_notes,
    b.auto_renew,
    b.attribution_window_days,
    b.last_click_attribution,
    b.utm_source,
    b.utm_medium,
    b.utm_campaign,
    b.tracking_code,
    b.display_name,
    b.description,
    b.logo_url,
    b.icon,
    b.color_code,
    b.min_lead_time_hours,
    b.max_lead_time_days,
    b.min_length_of_stay,
    b.max_length_of_stay,
    b.allowed_room_types,
    b.blocked_dates,
    b.notes,
    b.internal_notes,
    b.guest_facing_notes,
    b.metadata,
    b.created_by,
    b.updated_by,
    b.version
  FROM public.booking_sources b
  LEFT JOIN public.properties p ON b.property_id = p.id
  WHERE b.source_id = $1
    AND b.tenant_id = $2
    AND COALESCE(b.is_deleted, false) = false
`;

// =====================================================
// MARKET SEGMENT QUERIES
// =====================================================

export const MARKET_SEGMENT_LIST_SQL = `
  SELECT
    m.segment_id,
    m.tenant_id,
    m.property_id,
    p.property_name,
    m.segment_code,
    m.segment_name,
    m.segment_type,
    m.is_active,
    m.is_bookable,
    m.parent_segment_id,
    m.segment_level,
    m.average_daily_rate,
    m.average_length_of_stay,
    m.average_booking_value,
    m.contribution_to_revenue,
    m.booking_lead_time_days,
    m.cancellation_rate,
    m.no_show_rate,
    m.repeat_guest_rate,
    m.total_bookings,
    m.total_room_nights,
    m.total_revenue,
    m.rate_multiplier,
    m.discount_percentage,
    m.premium_percentage,
    m.pays_commission,
    m.commission_percentage,
    m.marketing_priority,
    m.is_target_segment,
    m.lifetime_value,
    m.loyalty_program_eligible,
    m.loyalty_points_multiplier,
    m.ranking,
    m.color_code,
    m.description,
    m.created_at,
    m.updated_at
  FROM public.market_segments m
  LEFT JOIN public.properties p ON m.property_id = p.id
  WHERE COALESCE(m.is_deleted, false) = false
    AND ($2::uuid IS NULL OR m.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR m.property_id = $3::uuid)
    AND ($4::text IS NULL OR m.segment_type = UPPER($4::text))
    AND ($5::boolean IS NULL OR m.is_active = $5::boolean)
    AND ($6::uuid IS NULL OR m.parent_segment_id = $6::uuid)
  ORDER BY COALESCE(m.ranking, 999) ASC, m.segment_name ASC
  LIMIT $1
`;

export const MARKET_SEGMENT_BY_ID_SQL = `
  SELECT
    m.segment_id,
    m.tenant_id,
    m.property_id,
    p.property_name,
    m.segment_code,
    m.segment_name,
    m.segment_type,
    m.is_active,
    m.is_bookable,
    m.parent_segment_id,
    m.segment_level,
    m.segment_path,
    m.average_daily_rate,
    m.average_length_of_stay,
    m.average_booking_value,
    m.contribution_to_revenue,
    m.booking_lead_time_days,
    m.cancellation_rate,
    m.no_show_rate,
    m.repeat_guest_rate,
    m.total_bookings,
    m.total_room_nights,
    m.total_revenue,
    m.rate_multiplier,
    m.min_rate,
    m.max_rate,
    m.default_rate_plan_id,
    m.discount_percentage,
    m.premium_percentage,
    m.pays_commission,
    m.commission_percentage,
    m.target_age_min,
    m.target_age_max,
    m.target_income_level,
    m.target_party_size,
    m.high_season_months,
    m.low_season_months,
    m.peak_booking_days,
    m.preferred_channels,
    m.marketing_priority,
    m.is_target_segment,
    m.acquisition_cost,
    m.lifetime_value,
    m.loyalty_program_eligible,
    m.loyalty_points_multiplier,
    m.min_advance_booking_days,
    m.max_advance_booking_days,
    m.min_length_of_stay,
    m.max_length_of_stay,
    m.allowed_days_of_week,
    m.blackout_dates,
    m.included_amenities,
    m.excluded_amenities,
    m.special_services,
    m.ranking,
    m.color_code,
    m.icon,
    m.description,
    m.sales_focus,
    m.requires_approval,
    m.approval_threshold,
    m.preferred_contact_method,
    m.email_template,
    m.tax_exempt,
    m.tax_rate_override,
    m.requires_id_verification,
    m.requires_company_info,
    m.notes,
    m.internal_notes,
    m.marketing_notes,
    m.metadata,
    m.created_at,
    m.created_by,
    m.updated_at,
    m.updated_by
  FROM public.market_segments m
  LEFT JOIN public.properties p ON m.property_id = p.id
  WHERE m.segment_id = $1
    AND m.tenant_id = $2
    AND COALESCE(m.is_deleted, false) = false
`;

// =====================================================
// CHANNEL MAPPING QUERIES
// =====================================================

export const CHANNEL_MAPPING_LIST_SQL = `
  SELECT
    c.id,
    c.tenant_id,
    c.property_id,
    p.property_name,
    c.channel_name,
    c.channel_code,
    c.entity_type,
    c.entity_id,
    c.external_id,
    c.external_code,
    c.mapping_config,
    c.last_sync_at,
    c.last_sync_status,
    c.last_sync_error,
    c.is_active,
    c.created_at,
    c.updated_at
  FROM public.channel_mappings c
  LEFT JOIN public.properties p ON c.property_id = p.id
  WHERE COALESCE(c.is_deleted, false) = false
    AND ($2::uuid IS NULL OR c.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR c.property_id = $3::uuid)
    AND ($4::text IS NULL OR c.channel_code = UPPER($4::text))
    AND ($5::text IS NULL OR c.entity_type = LOWER($5::text))
    AND ($6::boolean IS NULL OR c.is_active = $6::boolean)
  ORDER BY c.channel_name ASC, c.entity_type ASC
  LIMIT $1
`;

export const CHANNEL_MAPPING_BY_ID_SQL = `
  SELECT
    c.id,
    c.tenant_id,
    c.property_id,
    p.property_name,
    c.channel_name,
    c.channel_code,
    c.entity_type,
    c.entity_id,
    c.external_id,
    c.external_code,
    c.mapping_config,
    c.last_sync_at,
    c.last_sync_status,
    c.last_sync_error,
    c.is_active,
    c.metadata,
    c.created_at,
    c.updated_at,
    c.created_by,
    c.updated_by,
    c.version
  FROM public.channel_mappings c
  LEFT JOIN public.properties p ON c.property_id = p.id
  WHERE c.id = $1
    AND c.tenant_id = $2
    AND COALESCE(c.is_deleted, false) = false
`;

// =====================================================
// COMPANY QUERIES
// =====================================================

export const COMPANY_LIST_SQL = `
  SELECT
    c.company_id,
    c.tenant_id,
    c.company_name,
    c.legal_name,
    c.company_code,
    c.company_type,
    c.primary_contact_name,
    c.primary_contact_email,
    c.primary_contact_phone,
    c.billing_contact_name,
    c.billing_contact_email,
    c.city,
    c.state_province,
    c.country,
    c.credit_limit,
    c.current_balance,
    c.payment_terms,
    c.payment_terms_type,
    c.credit_status,
    c.commission_rate,
    c.commission_type,
    c.preferred_rate_code,
    c.discount_percentage,
    c.tax_id,
    c.tax_exempt,
    c.contract_number,
    c.contract_start_date,
    c.contract_end_date,
    c.contract_status,
    c.iata_number,
    c.arc_number,
    c.total_bookings,
    c.total_revenue,
    c.average_booking_value,
    c.last_booking_date,
    c.is_active,
    c.is_vip,
    c.is_blacklisted,
    c.requires_approval,
    c.created_at,
    c.updated_at
  FROM public.companies c
  WHERE COALESCE(c.is_deleted, false) = false
    AND ($2::uuid IS NULL OR c.tenant_id = $2::uuid)
    AND ($3::text IS NULL OR c.company_type = LOWER($3::text))
    AND ($4::boolean IS NULL OR c.is_active = $4::boolean)
    AND ($5::text IS NULL OR c.credit_status = LOWER($5::text))
    AND ($6::boolean IS NULL OR c.is_blacklisted = $6::boolean)
  ORDER BY c.company_name ASC
  LIMIT $1
`;

export const COMPANY_BY_ID_SQL = `
  SELECT
    c.company_id,
    c.tenant_id,
    c.company_name,
    c.legal_name,
    c.company_code,
    c.company_type,
    c.primary_contact_name,
    c.primary_contact_title,
    c.primary_contact_email,
    c.primary_contact_phone,
    c.billing_contact_name,
    c.billing_contact_email,
    c.billing_contact_phone,
    c.address_line1,
    c.address_line2,
    c.city,
    c.state_province,
    c.postal_code,
    c.country,
    c.credit_limit,
    c.current_balance,
    c.payment_terms,
    c.payment_terms_type,
    c.credit_status,
    c.commission_rate,
    c.commission_type,
    c.preferred_rate_code,
    c.discount_percentage,
    c.tax_id,
    c.tax_exempt,
    c.tax_exempt_certificate_number,
    c.tax_exempt_expiry_date,
    c.contract_number,
    c.contract_start_date,
    c.contract_end_date,
    c.contract_status,
    c.auto_renew,
    c.website_url,
    c.iata_number,
    c.arc_number,
    c.clia_number,
    c.total_bookings,
    c.total_revenue,
    c.average_booking_value,
    c.last_booking_date,
    c.customer_lifetime_value,
    c.preferred_communication_method,
    c.reporting_frequency,
    c.notes,
    c.internal_notes,
    c.is_active,
    c.is_vip,
    c.is_blacklisted,
    c.blacklist_reason,
    c.requires_approval,
    c.created_at,
    c.created_by,
    c.updated_at,
    c.updated_by,
    c.version
  FROM public.companies c
  WHERE c.company_id = $1
    AND c.tenant_id = $2
    AND COALESCE(c.is_deleted, false) = false
`;

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

// =====================================================
// WAITLIST ENTRY QUERIES
// =====================================================

export const WAITLIST_ENTRY_LIST_SQL = `
  SELECT
    w.waitlist_id,
    w.tenant_id,
    w.property_id,
    p.property_name,
    w.guest_id,
    g.first_name || ' ' || g.last_name AS guest_name,
    w.reservation_id,
    w.requested_room_type_id,
    rt.type_name AS room_type_name,
    w.requested_rate_id,
    w.arrival_date,
    w.departure_date,
    w.nights,
    w.number_of_rooms,
    w.number_of_adults,
    w.number_of_children,
    w.flexibility,
    w.waitlist_status,
    w.priority_score,
    w.vip_flag,
    w.last_notified_at,
    w.last_notified_via,
    w.offer_expiration_at,
    w.offer_response,
    w.offer_response_at,
    w.notes,
    w.created_at,
    w.updated_at
  FROM public.waitlist_entries w
  LEFT JOIN public.properties p ON w.property_id = p.id
  LEFT JOIN public.guests g ON w.guest_id = g.id
  LEFT JOIN public.room_types rt ON w.requested_room_type_id = rt.id
  WHERE COALESCE(w.is_deleted, false) = false
    AND ($2::uuid IS NULL OR w.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR w.property_id = $3::uuid)
    AND ($4::text IS NULL OR w.waitlist_status = UPPER($4::text))
    AND ($5::date IS NULL OR w.arrival_date >= $5::date)
    AND ($6::date IS NULL OR w.arrival_date <= $6::date)
    AND ($7::boolean IS NULL OR w.vip_flag = $7::boolean)
  ORDER BY w.priority_score DESC, w.created_at ASC
  LIMIT $1
`;

export const WAITLIST_ENTRY_BY_ID_SQL = `
  SELECT
    w.waitlist_id,
    w.tenant_id,
    w.property_id,
    p.property_name,
    w.guest_id,
    g.first_name || ' ' || g.last_name AS guest_name,
    w.reservation_id,
    w.requested_room_type_id,
    rt.type_name AS room_type_name,
    w.requested_rate_id,
    w.arrival_date,
    w.departure_date,
    w.nights,
    w.number_of_rooms,
    w.number_of_adults,
    w.number_of_children,
    w.flexibility,
    w.waitlist_status,
    w.priority_score,
    w.vip_flag,
    w.last_notified_at,
    w.last_notified_via,
    w.offer_expiration_at,
    w.offer_response,
    w.offer_response_at,
    w.notes,
    w.created_at,
    w.created_by,
    w.updated_at,
    w.updated_by
  FROM public.waitlist_entries w
  LEFT JOIN public.properties p ON w.property_id = p.id
  LEFT JOIN public.guests g ON w.guest_id = g.id
  LEFT JOIN public.room_types rt ON w.requested_room_type_id = rt.id
  WHERE w.waitlist_id = $1
    AND w.tenant_id = $2
    AND COALESCE(w.is_deleted, false) = false
`;

// =====================================================
// GROUP BOOKING QUERIES
// =====================================================

export const GROUP_BOOKING_LIST_SQL = `
  SELECT
    gb.group_booking_id,
    gb.tenant_id,
    gb.property_id,
    p.property_name,
    gb.group_name,
    gb.group_code,
    gb.group_type,
    gb.block_status,
    gb.company_id,
    c.company_name,
    gb.organization_name,
    gb.event_name,
    gb.event_type,
    gb.contact_name,
    gb.contact_email,
    gb.contact_phone,
    gb.arrival_date,
    gb.departure_date,
    gb.number_of_nights,
    gb.total_rooms_requested,
    gb.total_rooms_blocked,
    gb.total_rooms_picked,
    gb.total_rooms_confirmed,
    gb.cutoff_date,
    gb.cutoff_days_before_arrival,
    gb.release_unsold_rooms,
    gb.rooming_list_received,
    gb.rooming_list_deadline,
    gb.deposit_amount,
    gb.deposit_received,
    gb.negotiated_rate,
    gb.estimated_total_revenue,
    gb.actual_revenue,
    gb.contract_signed,
    gb.is_active,
    gb.booking_confidence,
    gb.account_manager_id,
    u.first_name || ' ' || u.last_name AS account_manager_name,
    gb.sales_manager_id,
    gb.created_at,
    gb.updated_at
  FROM public.group_bookings gb
  LEFT JOIN public.properties p ON gb.property_id = p.id
  LEFT JOIN public.companies c ON gb.company_id = c.company_id
  LEFT JOIN public.users u ON gb.account_manager_id = u.id
  WHERE gb.tenant_id = $2
    AND COALESCE(gb.is_deleted, false) = false
    AND ($3::uuid IS NULL OR gb.property_id = $3::uuid)
    AND ($4::text IS NULL OR gb.block_status = UPPER($4::text))
    AND ($5::text IS NULL OR gb.group_type = UPPER($5::text))
    AND ($6::date IS NULL OR gb.arrival_date >= $6::date)
    AND ($7::date IS NULL OR gb.arrival_date <= $7::date)
    AND ($8::boolean IS NULL OR gb.is_active = $8::boolean)
  ORDER BY gb.arrival_date DESC, gb.created_at DESC
  LIMIT $1
`;

export const GROUP_BOOKING_BY_ID_SQL = `
  SELECT
    gb.group_booking_id,
    gb.tenant_id,
    gb.property_id,
    p.property_name,
    gb.group_name,
    gb.group_code,
    gb.group_type,
    gb.block_status,
    gb.company_id,
    c.company_name,
    gb.organization_name,
    gb.event_name,
    gb.event_type,
    gb.contact_name,
    gb.contact_email,
    gb.contact_phone,
    gb.contact_mobile,
    gb.billing_contact_name,
    gb.billing_contact_email,
    gb.billing_contact_phone,
    gb.arrival_date,
    gb.departure_date,
    gb.number_of_nights,
    gb.total_rooms_requested,
    gb.total_rooms_blocked,
    gb.total_rooms_picked,
    gb.total_rooms_confirmed,
    gb.cutoff_date,
    gb.cutoff_days_before_arrival,
    gb.release_unsold_rooms,
    gb.rooming_list_received,
    gb.rooming_list_received_date,
    gb.rooming_list_deadline,
    gb.rooming_list_format,
    gb.master_folio_id,
    gb.payment_method,
    gb.deposit_amount,
    gb.deposit_percentage,
    gb.deposit_due_date,
    gb.deposit_received,
    gb.deposit_received_date,
    gb.rate_type,
    gb.negotiated_rate,
    gb.rack_rate,
    gb.discount_percentage,
    gb.commissionable,
    gb.commission_percentage,
    gb.complimentary_rooms,
    gb.complimentary_ratio,
    gb.meeting_space_required,
    gb.catering_required,
    gb.av_equipment_required,
    gb.shuttle_service_required,
    gb.special_requests,
    gb.estimated_total_revenue,
    gb.actual_revenue,
    gb.contract_signed,
    gb.contract_signed_date,
    gb.contract_document_url,
    gb.cancellation_policy,
    gb.cancellation_deadline,
    gb.confirmation_number,
    gb.is_active,
    gb.booking_confidence,
    gb.notes,
    gb.internal_notes,
    gb.account_manager_id,
    u.first_name || ' ' || u.last_name AS account_manager_name,
    gb.sales_manager_id,
    gb.booking_source,
    gb.created_at,
    gb.created_by,
    gb.updated_at,
    gb.updated_by
  FROM public.group_bookings gb
  LEFT JOIN public.properties p ON gb.property_id = p.id
  LEFT JOIN public.companies c ON gb.company_id = c.company_id
  LEFT JOIN public.users u ON gb.account_manager_id = u.id
  WHERE gb.group_booking_id = $1
    AND gb.tenant_id = $2
    AND COALESCE(gb.is_deleted, false) = false
`;

// =====================================================
// PROMOTIONAL CODE QUERIES
// =====================================================

export const PROMOTIONAL_CODE_LIST_SQL = `
  SELECT
    pc.promo_id,
    pc.tenant_id,
    pc.property_id,
    p.property_name,
    pc.promo_code,
    pc.promo_name,
    pc.promo_description,
    pc.promo_type,
    pc.promo_status,
    pc.is_active,
    pc.is_public,
    pc.valid_from,
    pc.valid_to,
    pc.discount_type,
    pc.discount_percent,
    pc.discount_amount,
    pc.discount_currency,
    pc.max_discount_amount,
    pc.free_nights_count,
    pc.has_usage_limit,
    pc.total_usage_limit,
    pc.usage_count,
    pc.remaining_uses,
    pc.per_user_limit,
    pc.minimum_stay_nights,
    pc.maximum_stay_nights,
    pc.minimum_booking_amount,
    pc.times_viewed,
    pc.times_applied,
    pc.times_redeemed,
    pc.total_discount_given,
    pc.total_revenue_generated,
    pc.conversion_rate,
    pc.combinable_with_other_promos,
    pc.auto_apply,
    pc.display_on_website,
    pc.requires_approval,
    pc.campaign_id,
    pc.marketing_source,
    pc.created_at,
    pc.updated_at
  FROM public.promotional_codes pc
  LEFT JOIN public.properties p ON pc.property_id = p.id
  WHERE pc.tenant_id = $2
    AND COALESCE(pc.is_deleted, false) = false
    AND ($3::uuid IS NULL OR pc.property_id = $3::uuid)
    AND ($4::text IS NULL OR pc.promo_status = UPPER($4::text))
    AND ($5::boolean IS NULL OR pc.is_active = $5::boolean)
    AND ($6::boolean IS NULL OR pc.is_public = $6::boolean)
    AND ($7::text IS NULL OR UPPER(pc.promo_code) LIKE '%' || UPPER($7::text) || '%')
  ORDER BY pc.created_at DESC
  LIMIT $1
`;

export const PROMOTIONAL_CODE_BY_ID_SQL = `
  SELECT
    pc.promo_id,
    pc.tenant_id,
    pc.property_id,
    p.property_name,
    pc.promo_code,
    pc.promo_name,
    pc.promo_description,
    pc.promo_type,
    pc.promo_status,
    pc.is_active,
    pc.is_public,
    pc.valid_from,
    pc.valid_to,
    pc.discount_type,
    pc.discount_percent,
    pc.discount_amount,
    pc.discount_currency,
    pc.max_discount_amount,
    pc.free_nights_count,
    pc.has_usage_limit,
    pc.total_usage_limit,
    pc.usage_count,
    pc.remaining_uses,
    pc.per_user_limit,
    pc.minimum_stay_nights,
    pc.maximum_stay_nights,
    pc.minimum_booking_amount,
    pc.advance_booking_days_min,
    pc.advance_booking_days_max,
    pc.applicable_check_in_from,
    pc.applicable_check_in_to,
    pc.blackout_dates,
    pc.applicable_days_of_week,
    pc.applicable_room_types,
    pc.excluded_room_types,
    pc.applicable_rate_codes,
    pc.excluded_rate_codes,
    pc.applicable_channels,
    pc.excluded_channels,
    pc.eligible_guest_types,
    pc.eligible_loyalty_tiers,
    pc.new_guests_only,
    pc.returning_guests_only,
    pc.times_viewed,
    pc.times_applied,
    pc.times_redeemed,
    pc.total_discount_given,
    pc.total_revenue_generated,
    pc.conversion_rate,
    pc.average_booking_value,
    pc.combinable_with_other_promos,
    pc.combinable_promo_codes,
    pc.mutually_exclusive_codes,
    pc.auto_apply,
    pc.auto_apply_conditions,
    pc.display_on_website,
    pc.display_message,
    pc.requires_approval,
    pc.terms_and_conditions,
    pc.campaign_id,
    pc.marketing_source,
    pc.notes,
    pc.tags,
    pc.created_at,
    pc.created_by,
    pc.updated_at,
    pc.updated_by
  FROM public.promotional_codes pc
  LEFT JOIN public.properties p ON pc.property_id = p.id
  WHERE pc.promo_id = $1
    AND pc.tenant_id = $2
    AND COALESCE(pc.is_deleted, false) = false
`;

export const PROMOTIONAL_CODE_BY_CODE_SQL = `
  SELECT
    pc.promo_id,
    pc.tenant_id,
    pc.property_id,
    pc.promo_code,
    pc.promo_name,
    pc.promo_description,
    pc.promo_status,
    pc.is_active,
    pc.valid_from,
    pc.valid_to,
    pc.discount_type,
    pc.discount_percent,
    pc.discount_amount,
    pc.discount_currency,
    pc.max_discount_amount,
    pc.free_nights_count,
    pc.has_usage_limit,
    pc.total_usage_limit,
    pc.usage_count,
    pc.remaining_uses,
    pc.per_user_limit,
    pc.minimum_stay_nights,
    pc.maximum_stay_nights,
    pc.minimum_booking_amount,
    pc.advance_booking_days_min,
    pc.advance_booking_days_max,
    pc.applicable_check_in_from,
    pc.applicable_check_in_to,
    pc.blackout_dates,
    pc.applicable_days_of_week,
    pc.applicable_room_types,
    pc.excluded_room_types,
    pc.applicable_rate_codes,
    pc.excluded_rate_codes,
    pc.applicable_channels,
    pc.excluded_channels,
    pc.eligible_guest_types,
    pc.eligible_loyalty_tiers,
    pc.new_guests_only,
    pc.returning_guests_only,
    pc.combinable_with_other_promos,
    pc.combinable_promo_codes,
    pc.mutually_exclusive_codes,
    pc.auto_apply
  FROM public.promotional_codes pc
  WHERE UPPER(pc.promo_code) = UPPER($1)
    AND pc.tenant_id = $2
    AND ($3::uuid IS NULL OR pc.property_id = $3::uuid)
    AND COALESCE(pc.is_deleted, false) = false
`;
