export const ASSOCIATION_LIST_SQL = `
  SELECT
    uta.id,
    uta.user_id,
    uta.tenant_id,
    uta.role,
    uta.is_active,
    uta.permissions,
    uta.valid_from,
    uta.valid_until,
    uta.metadata,
    uta.created_at,
    uta.updated_at,
    uta.created_by,
    uta.updated_by,
    uta.deleted_at,
    uta.version,
    u.username AS user_username,
    u.email AS user_email,
    u.first_name AS user_first_name,
    u.last_name AS user_last_name,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    t.status AS tenant_status
  FROM public.user_tenant_associations uta
  LEFT JOIN public.users u ON u.id = uta.user_id
  LEFT JOIN public.tenants t ON t.id = uta.tenant_id
  WHERE COALESCE(uta.is_deleted, false) = false
    AND uta.deleted_at IS NULL
    AND ($1::uuid IS NULL OR uta.tenant_id = $1::uuid)
    AND ($2::uuid IS NULL OR uta.user_id = $2::uuid)
    AND ($3::tenant_role IS NULL OR uta.role = $3::tenant_role)
    AND ($4::boolean IS NULL OR uta.is_active = $4)
  ORDER BY uta.created_at DESC
  LIMIT $5
`;
