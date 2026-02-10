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
  OFFSET $7
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
  OFFSET $7
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
  OFFSET $7
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
