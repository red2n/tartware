import { toNumberOrFallback } from "@tartware/config";
import type { IncidentStatusInput, IncidentWriteInput } from "@tartware/schemas";
import {
  type DeepCleanDueItem,
  DeepCleanDueItemSchema,
  type DeepCleanDueRow,
  formatDisplayLabel,
  type HousekeepingTaskListItem,
  HousekeepingTaskListItemSchema,
  type HousekeepingTaskRow,
  type IncidentReportDetail,
  type IncidentReportDetailRow,
  IncidentReportDetailSchema,
  type IncidentReportListItem,
  IncidentReportListItemSchema,
  type IncidentReportRow,
  type MaintenanceRequestListItem,
  MaintenanceRequestListItemSchema,
  type MaintenanceRequestRow,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  DEEP_CLEAN_DUE_SQL,
  HOUSEKEEPING_INSPECTION_LIST_SQL,
  HOUSEKEEPING_SCHEDULE_LIST_SQL,
  HOUSEKEEPING_TASK_LIST_SQL,
  INCIDENT_REPORT_BY_ID_SQL,
  INCIDENT_REPORT_LIST_SQL,
  MAINTENANCE_REQUEST_BY_ID_SQL,
  MAINTENANCE_REQUEST_LIST_SQL,
} from "../sql/housekeeping-queries.js";

/**
 * Re-export for backward compatibility.
 */
export const HousekeepingTaskSchema = HousekeepingTaskListItemSchema;
type HousekeepingTask = HousekeepingTaskListItem;

// HousekeepingTaskRow imported from @tartware/schemas

const toIsoString = (value: string | Date | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const normalizeStatus = (value: string | null): { value: string; display: string } => {
  if (!value || typeof value !== "string") {
    return { value: "unknown", display: "Unknown" };
  }
  const normalized = value.toLowerCase();
  const display = normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return { value: normalized, display };
};

const mapRowToTask = (row: HousekeepingTaskRow): HousekeepingTask => {
  const { value: status, display } = normalizeStatus(row.status);

  return HousekeepingTaskSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    room_number: row.room_number,
    task_type: row.task_type,
    priority: row.priority ?? undefined,
    status,
    status_display: display,
    assigned_to: row.assigned_to ?? undefined,
    assigned_at: toIsoString(row.assigned_at),
    scheduled_date: toIsoString(row.scheduled_date) ?? "",
    scheduled_time: row.scheduled_time ?? undefined,
    started_at: toIsoString(row.started_at),
    completed_at: toIsoString(row.completed_at),
    inspected_by: row.inspected_by ?? undefined,
    inspected_at: toIsoString(row.inspected_at),
    inspection_passed: row.inspection_passed ?? undefined,
    is_guest_request: Boolean(row.is_guest_request),
    special_instructions: row.special_instructions ?? undefined,
    notes: row.notes ?? undefined,
    issues_found: row.issues_found ?? undefined,
    credits: (() => {
      const credits = toNumberOrFallback(row.credits, 0);
      return credits > 0 ? credits : undefined;
    })(),
    metadata: row.metadata ?? undefined,
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at),
    version: row.version ? row.version.toString() : "0",
  });
};

/**
 * List housekeeping tasks with optional filters.
 */
export const listHousekeepingTasks = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  status?: string;
  scheduledDate?: string;
  offset?: number;
}): Promise<HousekeepingTask[]> => {
  const limit = options.limit ?? 200;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const status = options.status ? options.status.trim().toUpperCase() : null;
  const scheduledDate = options.scheduledDate ?? null;
  const offset = options.offset ?? 0;

  const { rows } = await query<HousekeepingTaskRow>(HOUSEKEEPING_TASK_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    status,
    scheduledDate,
    offset,
  ]);

  return rows.map(mapRowToTask);
};

/**
 * List housekeeping schedules (tasks with scheduled dates).
 */
export const listHousekeepingSchedules = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  dateFrom?: string;
  dateTo?: string;
  offset?: number;
}): Promise<HousekeepingTask[]> => {
  const limit = options.limit ?? 200;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const dateFrom = options.dateFrom ?? null;
  const dateTo = options.dateTo ?? null;
  const offset = options.offset ?? 0;

  const { rows } = await query<HousekeepingTaskRow>(HOUSEKEEPING_SCHEDULE_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    dateFrom,
    dateTo,
    offset,
  ]);

  return rows.map(mapRowToTask);
};

/**
 * List housekeeping inspections (tasks that have been inspected).
 */
export const listHousekeepingInspections = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  passed?: boolean;
  dateFrom?: string;
  dateTo?: string;
  offset?: number;
}): Promise<HousekeepingTask[]> => {
  const limit = options.limit ?? 200;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const passed = options.passed ?? null;
  const dateFrom = options.dateFrom ?? null;
  const dateTo = options.dateTo ?? null;
  const offset = options.offset ?? 0;

  const { rows } = await query<HousekeepingTaskRow>(HOUSEKEEPING_INSPECTION_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    passed,
    dateFrom,
    dateTo,
    offset,
  ]);

  return rows.map(mapRowToTask);
};

// ============================================================================
// DEEP CLEAN DUE (IS-1)
// ============================================================================

// DeepCleanDueRow imported from @tartware/schemas

const mapDeepCleanDueRow = (row: DeepCleanDueRow): DeepCleanDueItem => {
  return DeepCleanDueItemSchema.parse({
    room_id: row.room_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    room_number: row.room_number,
    room_type_name: row.room_type_name ?? undefined,
    floor: row.floor ?? undefined,
    status: row.status,
    housekeeping_status: row.housekeeping_status,
    last_deep_clean_date: row.last_deep_clean_date
      ? row.last_deep_clean_date instanceof Date
        ? row.last_deep_clean_date.toISOString().split("T")[0]
        : String(row.last_deep_clean_date).split("T")[0]
      : null,
    deep_clean_interval_days: toNumberOrFallback(row.deep_clean_interval_days, 30),
    days_since_deep_clean:
      row.days_since_deep_clean != null ? toNumberOrFallback(row.days_since_deep_clean, 0) : null,
    days_overdue: row.days_overdue != null ? toNumberOrFallback(row.days_overdue, 0) : null,
  });
};

/**
 * List rooms that are due for deep cleaning based on their configured interval.
 */
export const listDeepCleanDueRooms = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  offset?: number;
}): Promise<DeepCleanDueItem[]> => {
  const { rows } = await query<DeepCleanDueRow>(DEEP_CLEAN_DUE_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.offset ?? 0,
  ]);

  return rows.map(mapDeepCleanDueRow);
};

// =====================================================
// MAINTENANCE REQUEST SERVICE
// =====================================================

// MaintenanceRequestRow imported from @tartware/schemas

const mapMaintenanceRequestRow = (row: MaintenanceRequestRow): MaintenanceRequestListItem => {
  return MaintenanceRequestListItemSchema.parse({
    request_id: row.request_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    request_number: row.request_number,
    request_type: row.request_type?.toLowerCase() ?? "unknown",
    request_type_display: formatDisplayLabel(row.request_type),
    request_status: row.request_status?.toLowerCase() ?? "unknown",
    request_status_display: formatDisplayLabel(row.request_status),
    priority: row.priority?.toLowerCase() ?? "medium",
    priority_display: formatDisplayLabel(row.priority),
    room_id: row.room_id ?? undefined,
    room_number: row.room_number,
    location_description: row.location_description,
    location_type: row.location_type,
    issue_category: row.issue_category?.toLowerCase() ?? "other",
    issue_category_display: formatDisplayLabel(row.issue_category),
    issue_subcategory: row.issue_subcategory,
    issue_description: row.issue_description,
    affects_occupancy: Boolean(row.affects_occupancy),
    affects_guest_comfort: Boolean(row.affects_guest_comfort),
    is_safety_issue: Boolean(row.is_safety_issue),
    is_health_issue: Boolean(row.is_health_issue),
    reported_at: toIsoString(row.reported_at) ?? new Date().toISOString(),
    reported_by: row.reported_by,
    reporter_role: row.reporter_role,
    assigned_to: row.assigned_to ?? undefined,
    assigned_at: toIsoString(row.assigned_at),
    maintenance_team: row.maintenance_team,
    scheduled_date: toIsoString(row.scheduled_date)?.split("T")[0] ?? null,
    estimated_duration_minutes: row.estimated_duration_minutes,
    work_started_at: toIsoString(row.work_started_at),
    work_completed_at: toIsoString(row.work_completed_at),
    actual_duration_minutes: row.actual_duration_minutes,
    work_performed: row.work_performed,
    total_cost: row.total_cost != null ? toNumberOrFallback(row.total_cost, 0) : null,
    currency_code: row.currency_code ?? "USD",
    room_out_of_service: Boolean(row.room_out_of_service),
    oos_from: toIsoString(row.oos_from),
    oos_until: toIsoString(row.oos_until),
    response_time_minutes: row.response_time_minutes,
    resolution_time_hours: row.resolution_time_hours,
    is_within_sla: row.is_within_sla,
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoString(row.updated_at),
  });
};

/**
 * List maintenance requests with optional filters.
 */
export const listMaintenanceRequests = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  status?: string;
  priority?: string;
  issueCategory?: string;
  roomId?: string;
  roomOutOfService?: boolean;
  offset?: number;
}): Promise<MaintenanceRequestListItem[]> => {
  const limit = options.limit ?? 200;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const status = options.status ?? null;
  const priority = options.priority ?? null;
  const issueCategory = options.issueCategory ?? null;
  const roomId = options.roomId ?? null;
  const roomOutOfService = options.roomOutOfService ?? null;
  const offset = options.offset ?? 0;

  const { rows } = await query<MaintenanceRequestRow>(MAINTENANCE_REQUEST_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    status,
    priority,
    issueCategory,
    roomId,
    roomOutOfService,
    offset,
  ]);

  return rows.map(mapMaintenanceRequestRow);
};

/**
 * Get a single maintenance request by ID.
 */
export const getMaintenanceRequestById = async (options: {
  requestId: string;
  tenantId: string;
}): Promise<MaintenanceRequestListItem | null> => {
  const { rows } = await query<MaintenanceRequestRow>(MAINTENANCE_REQUEST_BY_ID_SQL, [
    options.requestId,
    options.tenantId,
  ]);

  const [row] = rows;
  if (!row) {
    return null;
  }

  return mapMaintenanceRequestRow(row);
};

// =====================================================
// INCIDENT REPORT SERVICE
// =====================================================

// IncidentReportRow imported from @tartware/schemas

const mapIncidentReportRow = (row: IncidentReportRow): IncidentReportListItem => {
  return IncidentReportListItemSchema.parse({
    incident_id: row.incident_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    incident_number: row.incident_number,
    incident_title: row.incident_title,
    incident_type: row.incident_type?.toLowerCase() ?? "other",
    incident_type_display: formatDisplayLabel(row.incident_type),
    incident_category: row.incident_category,
    severity: row.severity?.toLowerCase() ?? "moderate",
    severity_display: formatDisplayLabel(row.severity),
    severity_score: row.severity_score,
    incident_datetime: toIsoString(row.incident_datetime) ?? new Date().toISOString(),
    incident_date: (toIsoString(row.incident_date) ?? new Date().toISOString()).split("T")[0],
    incident_time: row.incident_time,
    incident_location: row.incident_location,
    room_number: row.room_number,
    floor_number: row.floor_number,
    area_name: row.area_name,
    guest_involved: Boolean(row.guest_involved),
    staff_involved: Boolean(row.staff_involved),
    third_party_involved: Boolean(row.third_party_involved),
    witness_count: row.witness_count ?? 0,
    injuries_sustained: Boolean(row.injuries_sustained),
    injury_severity: row.injury_severity,
    medical_attention_required: Boolean(row.medical_attention_required),
    property_damage: Boolean(row.property_damage),
    estimated_damage_cost:
      row.estimated_damage_cost != null ? toNumberOrFallback(row.estimated_damage_cost, 0) : null,
    incident_status: row.incident_status?.toLowerCase() ?? "reported",
    incident_status_display: formatDisplayLabel(row.incident_status),
    investigation_required: Boolean(row.investigation_required),
    investigation_completed: Boolean(row.investigation_completed),
    police_notified: Boolean(row.police_notified),
    police_report_number: row.police_report_number,
    insurance_claim_filed: Boolean(row.insurance_claim_filed),
    insurance_claim_number: row.insurance_claim_number,
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoString(row.updated_at),
    created_by: row.created_by,
  });
};

/**
 * List incident reports with optional filters.
 */
export const listIncidentReports = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  status?: string;
  severity?: string;
  incidentType?: string;
  incidentDate?: string;
  dateFrom?: string;
  dateTo?: string;
  offset?: number;
}): Promise<IncidentReportListItem[]> => {
  const limit = options.limit ?? 200;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const status = options.status ?? null;
  const severity = options.severity ?? null;
  const incidentType = options.incidentType ?? null;
  const incidentDate = options.incidentDate ?? null;
  const dateFrom = options.dateFrom ?? null;
  const dateTo = options.dateTo ?? null;
  const offset = options.offset ?? 0;

  const { rows } = await query<IncidentReportRow>(INCIDENT_REPORT_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    status,
    severity,
    incidentType,
    incidentDate,
    dateFrom,
    dateTo,
    offset,
  ]);

  return rows.map(mapIncidentReportRow);
};

/**
 * Map the by-id row, which carries the narrative columns the list shape omits.
 * Reusing the list mapper here is what made an incident's description, the
 * actions taken and the closure notes unreadable through the product.
 */
const mapIncidentReportDetailRow = (row: IncidentReportDetailRow): IncidentReportDetail => {
  return IncidentReportDetailSchema.parse({
    ...mapIncidentReportRow(row),
    incident_description: row.incident_description,
    immediate_actions_taken: row.immediate_actions_taken,
    discovered_by_name: row.discovered_by_name,
    guest_name: row.guest_name,
    injury_details: row.injury_details,
    damage_description: row.damage_description,
    investigation_findings: row.investigation_findings,
    corrective_actions: row.corrective_actions,
    follow_up_required: row.follow_up_required,
    follow_up_actions: row.follow_up_actions,
    closed_at: toIsoString(row.closed_at),
    closure_notes: row.closure_notes,
  });
};

/**
 * Get a single incident report by ID.
 */
export const getIncidentReportById = async (options: {
  incidentId: string;
  tenantId: string;
}): Promise<IncidentReportDetail | null> => {
  const { rows } = await query<IncidentReportDetailRow>(INCIDENT_REPORT_BY_ID_SQL, [
    options.incidentId,
    options.tenantId,
  ]);

  const [row] = rows;
  if (!row) {
    return null;
  }

  return mapIncidentReportDetailRow(row);
};

// =====================================================
// INCIDENT REPORTS — WRITE PATH
//
// The register was read-only: two GETs over a table nothing could write to, so
// incidents were recorded on paper and the table stayed empty. `operations.incident.report`
// is catalogued with a payload schema and a validator but has no consumer, and per
// ui-gaps/18-write-path-gap.md this is a single-service, single-table write with no
// fan-out — so it is plain HTTP and that catalog row should be dropped rather than
// implemented. See ui-gaps/06-incidents.md.
// =====================================================

/** `INC-YYYYMMDD-XXXX`, matching the police-report and folio numbering style. */
const buildIncidentNumber = (): string => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INC-${datePart}-${random}`;
};

/**
 * Report an incident.
 *
 * `created_by` is NOT NULL on this table, so an authenticated actor is required —
 * the route rejects the request rather than inventing a placeholder, because the
 * whole point of an incident record is knowing who filed it.
 */
export const createIncidentReport = async (
  tenantId: string,
  input: IncidentWriteInput,
  actorId: string,
): Promise<IncidentReportDetail | null> => {
  const { rows } = await query<{ incident_id: string }>(
    `
      INSERT INTO public.incident_reports (
        tenant_id, property_id, incident_number,
        incident_title, incident_type, incident_category, severity, severity_score,
        incident_date, incident_time, incident_datetime,
        incident_location, room_number, area_name,
        incident_description, immediate_actions_taken,
        incident_status,
        guest_involved, staff_involved, injury_severity, police_notified,
        discovered_by, discovered_by_name,
        created_by, updated_by
      ) VALUES (
        $1::uuid, $2::uuid, $3,
        $4, $5, $6, $7, $8,
        $9::date, $10::time, ($9::date + $10::time) AT TIME ZONE 'UTC',
        $11, $12, $13,
        $14, $15,
        'reported',
        COALESCE($16, false), COALESCE($17, false), $18, COALESCE($19, false),
        $20::uuid, $21,
        $20::uuid, $20::uuid
      )
      RETURNING incident_id
    `,
    [
      tenantId,
      input.propertyId,
      buildIncidentNumber(),
      input.incidentTitle,
      input.incidentType,
      input.incidentCategory ?? null,
      input.severity,
      input.severityScore ?? null,
      input.incidentDate,
      input.incidentTime,
      input.incidentLocation,
      input.roomNumber ?? null,
      input.areaName ?? null,
      input.incidentDescription,
      input.immediateActionsTaken,
      input.guestInvolved ?? null,
      input.staffInvolved ?? null,
      input.injurySeverity ?? null,
      input.policeNotified ?? null,
      actorId,
      input.discoveredByName ?? null,
    ],
  );

  const incidentId = rows[0]?.incident_id;
  if (!incidentId) return null;
  return getIncidentReportById({ incidentId, tenantId });
};

/** Correct an incident. Absent fields keep their stored value. */
export const updateIncidentReport = async (
  tenantId: string,
  incidentId: string,
  input: Partial<IncidentWriteInput>,
  actorId: string,
): Promise<IncidentReportDetail | null> => {
  const { rowCount } = await query(
    `
      UPDATE public.incident_reports
      SET
        incident_title = COALESCE($3, incident_title),
        incident_type = COALESCE($4, incident_type),
        incident_category = COALESCE($5, incident_category),
        severity = COALESCE($6, severity),
        severity_score = COALESCE($7, severity_score),
        incident_location = COALESCE($8, incident_location),
        room_number = COALESCE($9, room_number),
        area_name = COALESCE($10, area_name),
        incident_description = COALESCE($11, incident_description),
        immediate_actions_taken = COALESCE($12, immediate_actions_taken),
        guest_involved = COALESCE($13, guest_involved),
        staff_involved = COALESCE($14, staff_involved),
        injury_severity = COALESCE($15, injury_severity),
        police_notified = COALESCE($16, police_notified),
        updated_at = NOW(),
        updated_by = $17::uuid
      WHERE tenant_id = $1::uuid
        AND incident_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      tenantId,
      incidentId,
      input.incidentTitle ?? null,
      input.incidentType ?? null,
      input.incidentCategory ?? null,
      input.severity ?? null,
      input.severityScore ?? null,
      input.incidentLocation ?? null,
      input.roomNumber ?? null,
      input.areaName ?? null,
      input.incidentDescription ?? null,
      input.immediateActionsTaken ?? null,
      input.guestInvolved ?? null,
      input.staffInvolved ?? null,
      input.injurySeverity ?? null,
      input.policeNotified ?? null,
      actorId,
    ],
  );

  if (!rowCount) return null;
  return getIncidentReportById({ incidentId, tenantId });
};

/**
 * Move an incident through its status.
 *
 * `resolved_at` is stamped by the terminal statuses so "how long was this open"
 * stays answerable without a second field for the operator to remember.
 */
export const updateIncidentStatus = async (
  tenantId: string,
  incidentId: string,
  input: IncidentStatusInput,
  actorId: string,
): Promise<IncidentReportDetail | null> => {
  const { rowCount } = await query(
    `
      UPDATE public.incident_reports
      SET
        incident_status = $3::text,
        closure_notes = COALESCE($4, closure_notes),
        -- The table models closure as closed/closed_at/closed_by rather than a
        -- resolved_at timestamp, so a terminal status stamps all three. Verified
        -- against the live columns: there is no resolution_notes or resolved_at.
        closed = CASE WHEN $3::text IN ('resolved', 'closed') THEN true ELSE closed END,
        closed_at = CASE
          WHEN $3::text IN ('resolved', 'closed') THEN COALESCE(closed_at, NOW())
          ELSE closed_at
        END,
        closed_by = CASE
          WHEN $3::text IN ('resolved', 'closed') THEN COALESCE(closed_by, $5::uuid)
          ELSE closed_by
        END,
        updated_at = NOW(),
        updated_by = $5::uuid
      WHERE tenant_id = $1::uuid
        AND incident_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [tenantId, incidentId, input.incidentStatus, input.closureNotes ?? null, actorId],
  );

  if (!rowCount) return null;
  return getIncidentReportById({ incidentId, tenantId });
};
