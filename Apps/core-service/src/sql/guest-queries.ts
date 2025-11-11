export const GUEST_LIST_SQL = `
  SELECT
    g.id,
    g.tenant_id,
    g.first_name,
    g.last_name,
    g.middle_name,
    g.title,
    g.date_of_birth,
    g.gender,
    g.nationality,
    g.email,
    g.phone,
    g.secondary_phone,
    g.address,
    g.id_type,
    g.id_number,
    g.passport_number,
    g.passport_expiry,
    g.company_name,
    g.company_tax_id,
    g.loyalty_tier,
    g.loyalty_points,
    g.vip_status,
    g.preferences,
    g.marketing_consent,
    g.communication_preferences,
    g.total_bookings,
    g.total_nights,
    g.total_revenue,
    g.last_stay_date,
    g.is_blacklisted,
    g.blacklist_reason,
    g.notes,
    g.metadata,
    g.created_at,
    g.updated_at,
    g.created_by,
    g.updated_by,
    g.deleted_at,
    g.version
  FROM public.guests g
  WHERE COALESCE(g.is_deleted, false) = false
    AND g.deleted_at IS NULL
    AND ($2::uuid IS NULL OR g.tenant_id = $2::uuid)
    AND (
      $3::uuid IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.reservations r
        WHERE r.tenant_id = g.tenant_id
          AND r.guest_id = g.id
          AND r.property_id = $3::uuid
          AND COALESCE(r.is_deleted, false) = false
          AND r.deleted_at IS NULL
      )
    )
    AND ($4::text IS NULL OR g.email ILIKE $4)
    AND ($5::text IS NULL OR g.phone ILIKE $5)
    AND ($6::text IS NULL OR g.loyalty_tier = $6)
    AND ($7::boolean IS NULL OR g.vip_status = $7)
    AND ($8::boolean IS NULL OR g.is_blacklisted = $8)
  ORDER BY g.created_at DESC
  LIMIT $1
`;
