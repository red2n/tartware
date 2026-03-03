export const BUILDING_LIST_SQL = `
  SELECT
    b.building_id,
    b.tenant_id,
    b.property_id,
    b.building_code,
    b.building_name,
    b.building_type,
    b.floor_count,
    b.basement_floors,
    b.total_rooms,
    b.wheelchair_accessible,
    b.elevator_count,
    b.has_lobby,
    b.has_pool,
    b.has_gym,
    b.has_spa,
    b.has_restaurant,
    b.has_parking,
    b.parking_spaces,
    b.year_built,
    b.last_renovation_year,
    b.is_active,
    b.building_status,
    b.photo_url,
    b.guest_description,
    b.internal_notes,
    b.metadata,
    b.created_at,
    b.updated_at,
    b.version
  FROM public.buildings b
  WHERE COALESCE(b.is_deleted, false) = false
    AND b.deleted_at IS NULL
    AND b.tenant_id = $1::uuid
    AND ($2::uuid IS NULL OR b.property_id = $2::uuid)
    AND ($3::boolean IS NULL OR b.is_active = $3::boolean)
    AND ($4::text IS NULL OR b.building_type = $4)
    AND (
      $5::text IS NULL
      OR b.building_name ILIKE $5
      OR b.building_code ILIKE $5
    )
  ORDER BY b.building_code ASC
  LIMIT $6
  OFFSET $7
`;

export const BUILDING_CREATE_SQL = `
  WITH inserted AS (
    INSERT INTO public.buildings (
      tenant_id,
      property_id,
      building_code,
      building_name,
      building_type,
      floor_count,
      basement_floors,
      total_rooms,
      wheelchair_accessible,
      elevator_count,
      has_lobby,
      has_pool,
      has_gym,
      has_spa,
      has_restaurant,
      has_parking,
      parking_spaces,
      year_built,
      last_renovation_year,
      is_active,
      building_status,
      photo_url,
      guest_description,
      internal_notes,
      metadata,
      created_by,
      updated_by
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      COALESCE($5, 'MAIN'),
      $6,
      COALESCE($7, 0),
      COALESCE($8, 0),
      COALESCE($9, true),
      COALESCE($10, 0),
      COALESCE($11, false),
      COALESCE($12, false),
      COALESCE($13, false),
      COALESCE($14, false),
      COALESCE($15, false),
      COALESCE($16, false),
      COALESCE($17, 0),
      $18,
      $19,
      COALESCE($20, true),
      COALESCE($21, 'OPERATIONAL'),
      $22,
      $23,
      $24,
      COALESCE($25, '{}'::jsonb),
      $26,
      $26
    )
    RETURNING *
  )
  SELECT
    i.building_id,
    i.tenant_id,
    i.property_id,
    i.building_code,
    i.building_name,
    i.building_type,
    i.floor_count,
    i.basement_floors,
    i.total_rooms,
    i.wheelchair_accessible,
    i.elevator_count,
    i.has_lobby,
    i.has_pool,
    i.has_gym,
    i.has_spa,
    i.has_restaurant,
    i.has_parking,
    i.parking_spaces,
    i.year_built,
    i.last_renovation_year,
    i.is_active,
    i.building_status,
    i.photo_url,
    i.guest_description,
    i.internal_notes,
    i.metadata,
    i.created_at,
    i.updated_at,
    i.version
  FROM inserted i
`;

// Note: Building updates use a dynamic query builder in building-service.ts
// to support partial updates (distinguishing undefined vs null).

export const BUILDING_DELETE_SQL = `
  UPDATE public.buildings b
  SET
    is_deleted = true,
    deleted_at = CURRENT_TIMESTAMP,
    deleted_by = COALESCE($3, b.deleted_by),
    updated_at = CURRENT_TIMESTAMP,
    updated_by = COALESCE($3, b.updated_by),
    version = b.version + 1
  WHERE b.building_id = $1::uuid
    AND b.tenant_id = $2::uuid
    AND COALESCE(b.is_deleted, false) = false
    AND b.deleted_at IS NULL
  RETURNING b.building_id
`;
