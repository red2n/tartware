export const USER_LIST_SQL = `
  WITH filtered_users AS (
    SELECT u.*
    FROM public.users u
    WHERE COALESCE(u.is_deleted, false) = false
      AND u.deleted_at IS NULL
      AND ($2::uuid IS NULL OR EXISTS (
        SELECT 1
        FROM public.user_tenant_associations uta_filter
        WHERE uta_filter.user_id = u.id
          AND COALESCE(uta_filter.is_deleted, false) = false
          AND uta_filter.deleted_at IS NULL
          AND uta_filter.tenant_id = $2::uuid
      ))
  )
  SELECT
    u.id,
    u.username,
    u.email,
    u.first_name,
    u.last_name,
    u.phone,
    u.avatar_url,
    u.is_active,
    u.is_verified,
    u.email_verified_at,
    u.last_login_at,
    u.preferences,
    u.metadata,
    u.created_at,
    u.updated_at,
    u.created_by,
    u.updated_by,
    u.version,
    tenant_payload.tenants
  FROM filtered_users u
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'tenant_id', uta.tenant_id,
        'tenant_name', t.name,
        'role', uta.role,
        'is_active', uta.is_active
      )
      ORDER BY t.name
    ) AS tenants
    FROM public.user_tenant_associations uta
    LEFT JOIN public.tenants t ON t.id = uta.tenant_id
    WHERE uta.user_id = u.id
      AND COALESCE(uta.is_deleted, false) = false
      AND uta.deleted_at IS NULL
  ) tenant_payload ON true
  ORDER BY u.created_at DESC
  LIMIT $1
  OFFSET $3
`;
