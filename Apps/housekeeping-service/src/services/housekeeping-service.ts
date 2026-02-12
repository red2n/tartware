import {
  type HousekeepingTaskListItem,
  HousekeepingTaskListItemSchema,
  type IncidentReportListItem,
  IncidentReportListItemSchema,
  type MaintenanceRequestListItem,
  MaintenanceRequestListItemSchema,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  HOUSEKEEPING_INSPECTION_LIST_SQL,
  HOUSEKEEPING_SCHEDULE_LIST_SQL,
  HOUSEKEEPING_TASK_LIST_SQL,
  INCIDENT_REPORT_BY_ID_SQL,
  INCIDENT_REPORT_LIST_SQL,
  MAINTENANCE_REQUEST_BY_ID_SQL,
  MAINTENANCE_REQUEST_LIST_SQL,
} from "../sql/housekeeping-queries.js";
import { toNumberOrFallback } from "../utils/numbers.js";

/**
 * Re-export for backward compatibility.
 */
export const HousekeepingTaskSchema = HousekeepingTaskListItemSchema;
type HousekeepingTask = HousekeepingTaskListItem;

type HousekeepingTaskRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  room_number: string;
  task_type: string;
  priority: string | null;
  status: string | null;
  assigned_to: string | null;
  assigned_at: string | Date | null;
  scheduled_date: string | Date;
  scheduled_time: string | null;
  started_at: string | Date | null;
  completed_at: string | Date | null;
  inspected_by: string | null;
  inspected_at: string | Date | null;
  inspection_passed: boolean | null;
  is_guest_request: boolean | null;
  special_instructions: string | null;
  notes: string | null;
  issues_found: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date | null;
  version: bigint | null;
  credits: number | string | null;
};

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

// =====================================================
// MAINTENANCE REQUEST SERVICE
// =====================================================

type MaintenanceRequestRow = {
  request_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  request_number: string | null;
  request_type: string;
  request_status: string;
  priority: string;
  room_id: string | null;
  room_number: string | null;
  location_description: string | null;
  location_type: string | null;
  issue_category: string;
  issue_subcategory: string | null;
  issue_description: string;
  affects_occupancy: boolean;
  affects_guest_comfort: boolean;
  is_safety_issue: boolean;
  is_health_issue: boolean;
  reported_at: string | Date;
  reported_by: string;
  reporter_role: string | null;
  assigned_to: string | null;
  assigned_at: string | Date | null;
  maintenance_team: string | null;
  scheduled_date: string | Date | null;
  estimated_duration_minutes: number | null;
  work_started_at: string | Date | null;
  work_completed_at: string | Date | null;
  actual_duration_minutes: number | null;
  work_performed: string | null;
  total_cost: number | string | null;
  currency_code: string;
  room_out_of_service: boolean;
  oos_from: string | Date | null;
  oos_until: string | Date | null;
  response_time_minutes: number | null;
  resolution_time_hours: number | null;
  is_within_sla: boolean | null;
  created_at: string | Date;
  updated_at: string | Date | null;
};

const formatDisplayLabel = (value: string | null): string => {
  if (!value || typeof value !== "string") {
    return "Unknown";
  }
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

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

type IncidentReportRow = {
  incident_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  incident_number: string;
  incident_title: string;
  incident_type: string;
  incident_category: string | null;
  severity: string;
  severity_score: number | null;
  incident_datetime: string | Date;
  incident_date: string | Date;
  incident_time: string;
  incident_location: string;
  room_number: string | null;
  floor_number: number | null;
  area_name: string | null;
  guest_involved: boolean;
  staff_involved: boolean;
  third_party_involved: boolean;
  witness_count: number;
  injuries_sustained: boolean;
  injury_severity: string | null;
  medical_attention_required: boolean;
  property_damage: boolean;
  estimated_damage_cost: number | string | null;
  incident_status: string;
  investigation_required: boolean;
  investigation_completed: boolean;
  police_notified: boolean;
  police_report_number: string | null;
  insurance_claim_filed: boolean;
  insurance_claim_number: string | null;
  created_at: string | Date;
  updated_at: string | Date | null;
  created_by: string;
};

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
 * Get a single incident report by ID.
 */
export const getIncidentReportById = async (options: {
  incidentId: string;
  tenantId: string;
}): Promise<IncidentReportListItem | null> => {
  const { rows } = await query<IncidentReportRow>(INCIDENT_REPORT_BY_ID_SQL, [
    options.incidentId,
    options.tenantId,
  ]);

  const [row] = rows;
  if (!row) {
    return null;
  }

  return mapIncidentReportRow(row);
};
