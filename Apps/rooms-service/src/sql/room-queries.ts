export const ROOM_LIST_SQL = `
  SELECT
    r.id,
    r.tenant_id,
    r.property_id,
    p.property_name,
    r.room_type_id,
    rt.type_name AS room_type_name,
    rt.amenities AS room_type_amenities,
    r.room_number,
    r.room_name,
    r.floor,
    r.building,
    r.wing,
    r.status,
    r.housekeeping_status,
    r.maintenance_status,
    r.features,
    r.amenities,
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
  OFFSET $7
`;

export const ROOM_GET_BY_ID_SQL = `
  SELECT
    r.id,
    r.tenant_id,
    r.property_id,
    p.property_name,
    r.room_type_id,
    rt.type_name AS room_type_name,
    rt.amenities AS room_type_amenities,
    r.room_number,
    r.room_name,
    r.floor,
    r.building,
    r.wing,
    r.status,
    r.housekeeping_status,
    r.maintenance_status,
    r.features,
    r.amenities,
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
  WHERE r.id = $1::uuid
    AND r.tenant_id = $2::uuid
    AND COALESCE(r.is_deleted, false) = false
    AND r.deleted_at IS NULL
`;

export const ROOM_CREATE_SQL = `
  WITH inserted AS (
    INSERT INTO public.rooms (
      tenant_id,
      property_id,
      room_type_id,
      room_number,
      room_name,
      floor,
      building,
      wing,
      status,
      housekeeping_status,
      maintenance_status,
      features,
      amenities,
      is_blocked,
      block_reason,
      blocked_from,
      blocked_until,
      is_out_of_order,
      out_of_order_reason,
      out_of_order_since,
      expected_ready_date,
      notes,
      housekeeping_notes,
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
      $7,
      $8,
      COALESCE($9, 'SETUP')::room_status,
      COALESCE($10, 'CLEAN')::housekeeping_status,
      COALESCE($11, 'OPERATIONAL')::maintenance_status,
      COALESCE($12, '{}'::jsonb),
      COALESCE($13, '[]'::jsonb),
      COALESCE($14, false),
      $15,
      $16,
      $17,
      COALESCE($18, false),
      $19,
      $20,
      $21,
      $22,
      $23,
      COALESCE($24, '{}'::jsonb),
      $25,
      $25
    )
    RETURNING *
  )
  SELECT
    i.id,
    i.tenant_id,
    i.property_id,
    p.property_name,
    i.room_type_id,
    rt.type_name AS room_type_name,
    rt.amenities AS room_type_amenities,
    i.room_number,
    i.room_name,
    i.floor,
    i.building,
    i.wing,
    i.status,
    i.housekeeping_status,
    i.maintenance_status,
    i.features,
    i.amenities,
    i.is_blocked,
    i.block_reason,
    i.is_out_of_order,
    i.out_of_order_reason,
    i.expected_ready_date,
    i.housekeeping_notes,
    i.metadata,
    i.updated_at,
    i.version
  FROM inserted i
  LEFT JOIN public.room_types rt
    ON i.room_type_id = rt.id
  LEFT JOIN public.properties p
    ON i.property_id = p.id
`;
