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
  OFFSET $8
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
