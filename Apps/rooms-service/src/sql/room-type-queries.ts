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

export const ROOM_TYPE_UPDATE_SQL = `
  WITH updated AS (
    UPDATE public.room_types rt
    SET
      property_id = COALESCE($3, rt.property_id),
      type_name = COALESCE($4, rt.type_name),
      type_code = COALESCE($5, rt.type_code),
      description = COALESCE($6, rt.description),
      short_description = COALESCE($7, rt.short_description),
      category = COALESCE($8, rt.category),
      base_occupancy = COALESCE($9, rt.base_occupancy),
      max_occupancy = COALESCE($10, rt.max_occupancy),
      max_adults = COALESCE($11, rt.max_adults),
      max_children = COALESCE($12, rt.max_children),
      extra_bed_capacity = COALESCE($13, rt.extra_bed_capacity),
      size_sqm = COALESCE($14, rt.size_sqm),
      bed_type = COALESCE($15, rt.bed_type),
      number_of_beds = COALESCE($16, rt.number_of_beds),
      amenities = COALESCE($17, rt.amenities),
      features = COALESCE($18, rt.features),
      base_price = COALESCE($19, rt.base_price),
      currency = COALESCE($20, rt.currency),
      images = COALESCE($21, rt.images),
      display_order = COALESCE($22, rt.display_order),
      is_active = COALESCE($23, rt.is_active),
      metadata = COALESCE($24, rt.metadata),
      updated_at = CURRENT_TIMESTAMP,
      updated_by = COALESCE($25, rt.updated_by),
      version = rt.version + 1
    WHERE rt.id = $1::uuid
      AND rt.tenant_id = $2::uuid
      AND COALESCE(rt.is_deleted, false) = false
      AND rt.deleted_at IS NULL
    RETURNING *
  )
  SELECT
    u.id,
    u.tenant_id,
    u.property_id,
    u.type_name,
    u.type_code,
    u.description,
    u.short_description,
    u.category,
    u.base_occupancy,
    u.max_occupancy,
    u.max_adults,
    u.max_children,
    u.extra_bed_capacity,
    u.size_sqm,
    u.bed_type,
    u.number_of_beds,
    u.amenities,
    u.features,
    u.base_price,
    u.currency,
    u.images,
    u.display_order,
    u.is_active,
    u.metadata,
    u.created_at,
    u.updated_at,
    u.version
  FROM updated u
`;

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
