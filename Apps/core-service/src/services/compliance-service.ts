import { query } from "../lib/db.js";

type BreachReportParams = {
  tenantId: string;
  propertyId?: string;
  incidentTitle: string;
  incidentDescription: string;
  severity: string;
  breachType: string;
  discoveredAt: string;
  occurredAt?: string;
  dataCategoriesAffected?: string[];
  systemsAffected?: string[];
  subjectsAffectedCount?: number;
  assignedTo?: string;
  reportedBy?: string;
  metadata?: Record<string, unknown>;
};

type BreachNotifyParams = {
  tenantId: string;
  incidentId: string;
  authorityReference?: string;
  notifySubjects?: boolean;
  notificationNotes?: string;
  updatedBy?: string;
};

type BreachListParams = {
  tenantId: string;
  propertyId?: string;
  status?: string;
  severity?: string;
  limit?: number;
  offset?: number;
};

/**
 * Report a new data breach incident. Automatically sets 72-hour notification deadline per GDPR Art. 33.
 */
export const reportBreach = async (params: BreachReportParams): Promise<{ incident_id: string }> => {
  const { rows } = await query<{ incident_id: string }>(
    `
      INSERT INTO public.data_breach_incidents (
        tenant_id, property_id, incident_title, incident_description,
        severity, breach_type, discovered_at, occurred_at,
        notification_deadline, data_categories_affected, systems_affected,
        subjects_affected_count, reported_by, assigned_to,
        status, metadata, created_at, updated_at, created_by
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4,
        $5, $6, $7::timestamptz, $8::timestamptz,
        $7::timestamptz + INTERVAL '72 hours', $9, $10,
        $11, $12::uuid, $13::uuid,
        'reported', COALESCE($14::jsonb, '{}'::jsonb), NOW(), NOW(), $12::uuid
      )
      RETURNING incident_id
    `,
    [
      params.tenantId,
      params.propertyId ?? null,
      params.incidentTitle,
      params.incidentDescription,
      params.severity,
      params.breachType,
      params.discoveredAt,
      params.occurredAt ?? null,
      params.dataCategoriesAffected ?? null,
      params.systemsAffected ?? null,
      params.subjectsAffectedCount ?? null,
      params.reportedBy ?? null,
      params.assignedTo ?? null,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ],
  );
  const result = rows[0];
  if (!result) {
    throw new Error("Failed to create breach incident");
  }
  return result;
};

/**
 * Notify authority and/or subjects for a breach incident.
 */
export const notifyBreach = async (params: BreachNotifyParams): Promise<void> => {
  const setClauses: string[] = [
    "authority_notified = TRUE",
    "authority_notified_at = NOW()",
    "status = 'notifying'",
    "updated_at = NOW()",
  ];
  const queryParams: unknown[] = [params.tenantId, params.incidentId];
  let idx = 3;

  if (params.authorityReference !== undefined) {
    setClauses.push(`authority_reference = $${idx}`);
    queryParams.push(params.authorityReference);
    idx++;
  }

  if (params.notifySubjects) {
    setClauses.push("subjects_notified = TRUE");
    setClauses.push("subjects_notified_at = NOW()");
  }

  if (params.updatedBy) {
    setClauses.push(`updated_by = $${idx}::uuid`);
    queryParams.push(params.updatedBy);
    idx++;
  }

  const { rowCount } = await query(
    `
      UPDATE public.data_breach_incidents
      SET ${setClauses.join(", ")}
      WHERE tenant_id = $1::uuid
        AND incident_id = $2::uuid
    `,
    queryParams,
  );

  if (!rowCount || rowCount === 0) {
    throw new Error("Breach incident not found");
  }
};

/**
 * List breach incidents with optional filters.
 */
export const listBreachIncidents = async (params: BreachListParams) => {
  const conditions: string[] = ["tenant_id = $1::uuid"];
  const queryParams: unknown[] = [params.tenantId];
  let idx = 2;

  if (params.propertyId) {
    conditions.push(`property_id = $${idx}::uuid`);
    queryParams.push(params.propertyId);
    idx++;
  }
  if (params.status) {
    conditions.push(`status = $${idx}`);
    queryParams.push(params.status);
    idx++;
  }
  if (params.severity) {
    conditions.push(`severity = $${idx}`);
    queryParams.push(params.severity);
    idx++;
  }

  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  const { rows } = await query(
    `
      SELECT incident_id, tenant_id, property_id, incident_title,
             severity, breach_type, status,
             discovered_at, notification_deadline,
             authority_notified, subjects_notified,
             subjects_affected_count, assigned_to,
             created_at, updated_at
      FROM public.data_breach_incidents
      WHERE ${conditions.join(" AND ")}
      ORDER BY discovered_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `,
    [...queryParams, limit, offset],
  );
  return rows;
};

/**
 * Get a single breach incident by ID.
 */
export const getBreachIncidentById = async (tenantId: string, incidentId: string) => {
  const { rows } = await query(
    `
      SELECT *
      FROM public.data_breach_incidents
      WHERE tenant_id = $1::uuid
        AND incident_id = $2::uuid
    `,
    [tenantId, incidentId],
  );
  return rows[0] ?? null;
};
