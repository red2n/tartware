export const ROOM_TYPE_LIST_SQL = `
  SELECT
    rt.id,
    rt.tenant_id,
    rt.property_id,
    rt.type_name,
    rt.type_code,
    rt.description,
    rt.short_description,
    rt.category,
    rt.base_occupancy,
    rt.max_occupancy,
    rt.max_adults,
    rt.max_children,
    rt.extra_bed_capacity,
    rt.size_sqm,
    rt.bed_type,
    rt.number_of_beds,
    rt.amenities,
    rt.features,
    rt.base_price,
    rt.currency,
    rt.images,
    rt.display_order,
    rt.is_active,
    rt.metadata,
    rt.created_at,
    rt.updated_at,
    rt.version
  FROM public.room_types rt
  WHERE COALESCE(rt.is_deleted, false) = false
    AND rt.deleted_at IS NULL
    AND rt.tenant_id = $1::uuid
    AND ($2::uuid IS NULL OR rt.property_id = $2::uuid)
    AND ($3::boolean IS NULL OR rt.is_active = $3::boolean)
    AND (
      $4::text IS NULL
      OR rt.type_name ILIKE $4
      OR rt.type_code ILIKE $4
    )
  ORDER BY rt.display_order ASC, rt.type_name ASC
  LIMIT $5
  OFFSET $6
`;

export const ROOM_TYPE_CREATE_SQL = `
  WITH inserted AS (
    INSERT INTO public.room_types (
      tenant_id,
      property_id,
      type_name,
      type_code,
      description,
      short_description,
      category,
      base_occupancy,
      max_occupancy,
      max_adults,
      max_children,
      extra_bed_capacity,
      size_sqm,
      bed_type,
      number_of_beds,
      amenities,
      features,
      base_price,
      currency,
      images,
      display_order,
      is_active,
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
      COALESCE($7, 'STANDARD')::room_category,
      COALESCE($8, 2),
      COALESCE($9, 2),
      COALESCE($10, 2),
      COALESCE($11, 0),
      COALESCE($12, 0),
      $13,
      $14,
      COALESCE($15, 1),
      COALESCE($16, '[]'::jsonb),
      COALESCE($17, '{}'::jsonb),
      $18,
      COALESCE($19, 'USD'),
      COALESCE($20, '[]'::jsonb),
      COALESCE($21, 0),
      COALESCE($22, true),
      COALESCE($23, '{}'::jsonb),
      $24,
      $24
    )
    RETURNING *
  )
  SELECT
    i.id,
    i.tenant_id,
    i.property_id,
    i.type_name,
    i.type_code,
    i.description,
    i.short_description,
    i.category,
    i.base_occupancy,
    i.max_occupancy,
    i.max_adults,
    i.max_children,
    i.extra_bed_capacity,
    i.size_sqm,
    i.bed_type,
    i.number_of_beds,
    i.amenities,
    i.features,
    i.base_price,
    i.currency,
    i.images,
    i.display_order,
    i.is_active,
    i.metadata,
    i.created_at,
    i.updated_at,
    i.version
  FROM inserted i
`;

// Note: Room type updates use a dynamic query builder in room-type-service.ts
// to support partial updates (distinguishing undefined vs null).

export const ROOM_TYPE_DELETE_SQL = `
  UPDATE public.room_types rt
  SET
    is_deleted = true,
    deleted_at = CURRENT_TIMESTAMP,
    deleted_by = COALESCE($3, rt.deleted_by),
    updated_at = CURRENT_TIMESTAMP,
    updated_by = COALESCE($3, rt.updated_by),
    version = rt.version + 1
  WHERE rt.id = $1::uuid
    AND rt.tenant_id = $2::uuid
    AND COALESCE(rt.is_deleted, false) = false
    AND rt.deleted_at IS NULL
  RETURNING rt.id
`;
