export const TENANT_LIST_SQL = `
  SELECT
    t.id,
    t.name,
    t.slug,
    t.type,
    t.status,
    t.email,
    t.phone,
    t.website,
    t.address_line1,
    t.address_line2,
    t.city,
    t.state,
    t.postal_code,
    t.country,
    t.tax_id,
    t.business_license,
    t.registration_number,
    t.config,
    t.subscription,
    t.metadata,
    t.created_at,
    t.updated_at,
    t.created_by,
    t.updated_by,
    t.deleted_at,
    t.version,
    COALESCE(pc.property_count, 0) AS property_count,
    COALESCE(uc.user_count, 0) AS user_count,
    COALESCE(apc.active_properties, 0) AS active_properties
  FROM public.tenants t
  LEFT JOIN (
    SELECT tenant_id, COUNT(*)::int AS property_count
    FROM public.properties
    WHERE COALESCE(is_deleted, false) = false AND deleted_at IS NULL
    GROUP BY tenant_id
  ) pc ON pc.tenant_id = t.id
  LEFT JOIN (
    SELECT tenant_id, COUNT(*)::int AS user_count
    FROM public.user_tenant_associations
    WHERE COALESCE(is_deleted, false) = false AND deleted_at IS NULL
    GROUP BY tenant_id
  ) uc ON uc.tenant_id = t.id
  LEFT JOIN (
    SELECT tenant_id, COUNT(*)::int AS active_properties
    FROM public.properties
    WHERE COALESCE(is_deleted, false) = false AND deleted_at IS NULL AND is_active = true
    GROUP BY tenant_id
  ) apc ON apc.tenant_id = t.id
  WHERE COALESCE(t.is_deleted, false) = false AND t.deleted_at IS NULL
  ORDER BY t.created_at DESC
  LIMIT $1
`;
