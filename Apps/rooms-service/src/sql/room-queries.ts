export const ROOM_LIST_SQL = `
  SELECT
    r.id,
    r.tenant_id,
    r.property_id,
    p.property_name,
    r.room_type_id,
    rt.type_name AS room_type_name,
    r.room_number,
    r.room_name,
    r.floor,
    r.building,
    r.wing,
    r.status,
    r.housekeeping_status,
    r.maintenance_status,
    r.is_blocked,
    r.block_reason,
    r.is_out_of_order,
    r.out_of_order_reason,
    r.expected_ready_date,
    r.housekeeping_notes,
    r.metadata,
    r.updated_at,
    r.version
  FROM public.rooms r
  LEFT JOIN public.room_types rt
    ON r.room_type_id = rt.id
  LEFT JOIN public.properties p
    ON r.property_id = p.id
  WHERE COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
    AND ($2::uuid IS NULL OR r.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR r.property_id = $3::uuid)
    AND (
      $4::text IS NULL
      OR r.status = UPPER($4::text)::room_status
    )
    AND (
      $5::text IS NULL
      OR r.housekeeping_status = UPPER($5::text)::housekeeping_status
    )
    AND (
      $6::text IS NULL
      OR r.room_number ILIKE $6
      OR r.room_name ILIKE $6
      OR rt.type_name ILIKE $6
    )
  ORDER BY r.room_number ASC
  LIMIT $1
`;
