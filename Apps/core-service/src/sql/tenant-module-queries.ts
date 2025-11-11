export const TENANT_MODULES_SQL = `
  SELECT
    COALESCE(t.config -> 'modules', '["core"]'::jsonb) AS modules
  FROM public.tenants t
  WHERE t.id = $1::uuid
    AND COALESCE(t.is_deleted, false) = false
    AND t.deleted_at IS NULL
  LIMIT 1
`;
