export const HOUSEKEEPING_TASK_LIST_SQL = `
  SELECT
    h.id,
    h.tenant_id,
    h.property_id,
    p.property_name,
    h.room_number,
    h.task_type,
    h.priority,
    h.status,
    h.assigned_to,
    h.assigned_at,
    h.scheduled_date,
    h.scheduled_time,
    h.started_at,
    h.completed_at,
    h.inspected_by,
    h.inspected_at,
    h.inspection_passed,
    h.is_guest_request,
    h.special_instructions,
    h.notes,
    h.issues_found,
    h.metadata,
    h.created_at,
    h.updated_at,
    h.version
  FROM public.housekeeping_tasks h
  LEFT JOIN public.properties p
    ON h.property_id = p.id
  WHERE COALESCE(h.is_deleted, false) = false
    AND h.deleted_at IS NULL
    AND ($2::uuid IS NULL OR h.tenant_id = $2::uuid)
    AND ($3::uuid IS NULL OR h.property_id = $3::uuid)
    AND (
      $4::text IS NULL
      OR h.status = UPPER($4::text)::housekeeping_status
    )
    AND (
      $5::date IS NULL
      OR h.scheduled_date = $5::date
    )
  ORDER BY h.scheduled_date DESC, h.scheduled_time DESC NULLS LAST, h.created_at DESC
  LIMIT $1
`;
