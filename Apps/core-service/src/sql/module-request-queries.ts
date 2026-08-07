/**
 * Requester and reviewer names are resolved here rather than in the UI, so a
 * screen showing the queue does not have to fan out to /users per row.
 */
const REQUEST_COLUMNS = `
    r.id,
    r.tenant_id,
    r.property_id,
    r.module_id,
    r.requested_by,
    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS requested_by_name,
    r.requested_screen,
    r.reason,
    r.status,
    r.reviewed_by,
    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.email) AS reviewed_by_name,
    r.reviewed_at,
    r.review_notes,
    r.created_at
`;

const REQUEST_JOINS = `
  FROM public.module_access_requests r
  JOIN public.users u ON u.id = r.requested_by
  LEFT JOIN public.users a ON a.id = r.reviewed_by
`;

/**
 * A second person blocked on the same module joins the open request instead of
 * filing a duplicate — their reason is kept only if the first left none, so an
 * admin never loses the original justification.
 */
export const CREATE_MODULE_REQUEST_SQL = `
  INSERT INTO public.module_access_requests
    (tenant_id, property_id, module_id, requested_by, requested_screen, reason)
  VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6)
  ON CONFLICT (tenant_id, module_id) WHERE status = 'pending' AND is_deleted = false
  DO UPDATE SET
    reason = COALESCE(NULLIF(public.module_access_requests.reason, ''), EXCLUDED.reason),
    updated_at = NOW(),
    version = public.module_access_requests.version + 1
  RETURNING id
`;

export const GET_MODULE_REQUEST_BY_ID_SQL = `
  SELECT ${REQUEST_COLUMNS}
  ${REQUEST_JOINS}
  WHERE r.id = $1::uuid
    AND r.tenant_id = $2::uuid
    AND r.is_deleted = false
  LIMIT 1
`;

/** $3 is an optional status filter; NULL returns every status. */
export const LIST_MODULE_REQUESTS_SQL = `
  SELECT ${REQUEST_COLUMNS}
  ${REQUEST_JOINS}
  WHERE r.tenant_id = $1::uuid
    AND r.is_deleted = false
    AND ($2::text IS NULL OR r.status = $2::text)
  ORDER BY
    -- Pending first: the admin's queue is what the panel opens on.
    CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
    r.created_at DESC
  LIMIT $3::int
`;

/** Requests the caller raised themselves, so a non-admin can see where they stand. */
export const LIST_MY_MODULE_REQUESTS_SQL = `
  SELECT ${REQUEST_COLUMNS}
  ${REQUEST_JOINS}
  WHERE r.tenant_id = $1::uuid
    AND r.requested_by = $2::uuid
    AND r.is_deleted = false
  ORDER BY r.created_at DESC
  LIMIT 50
`;

/**
 * Guarded on status = 'pending' so two admins clicking Approve at the same
 * moment cannot both record a decision — the second update matches no row.
 */
export const REVIEW_MODULE_REQUEST_SQL = `
  UPDATE public.module_access_requests
     SET status = $3,
         reviewed_by = $4::uuid,
         reviewed_at = NOW(),
         review_notes = $5,
         updated_at = NOW(),
         version = version + 1
   WHERE id = $1::uuid
     AND tenant_id = $2::uuid
     AND status = 'pending'
     AND is_deleted = false
  RETURNING id, module_id
`;
