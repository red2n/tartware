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
  OFFSET $8
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
  OFFSET $9
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
  OFFSET $8
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
