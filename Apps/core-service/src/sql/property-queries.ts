export const PROPERTY_LIST_SQL = `
  SELECT
    p.id,
    p.tenant_id,
    p.property_name,
    p.property_code,
    p.address,
    p.phone,
    p.email,
    p.website,
    p.property_type,
    p.star_rating,
    p.total_rooms,
    p.tax_id,
    p.license_number,
    p.currency,
    p.timezone,
    p.config,
    p.integrations,
    p.is_active,
    p.metadata,
    p.created_at,
    p.updated_at,
    p.created_by,
    p.updated_by,
    p.deleted_at,
    p.version
  FROM public.properties p
  WHERE COALESCE(p.is_deleted, false) = false
    AND p.deleted_at IS NULL
    AND ($2::uuid IS NULL OR p.tenant_id = $2::uuid)
  ORDER BY p.created_at DESC
  LIMIT $1
`;
