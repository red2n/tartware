/**
 * Night Audit Service
 * Purpose: Service functions for night audit status, history, and OTA connections
 */

import {
  type BusinessDateStatusResponse,
  BusinessDateStatusResponseSchema,
  type NightAuditRunDetailResponse,
  NightAuditRunDetailResponseSchema,
  type NightAuditRunListItem,
  NightAuditRunListItemSchema,
  type NightAuditStep,
  NightAuditStepSchema,
  type OtaConnectionListItem,
  OtaConnectionListItemSchema,
  type OtaSyncLog,
  OtaSyncLogSchema,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  BUSINESS_DATE_STATUS_SQL,
  NIGHT_AUDIT_HISTORY_SQL,
  NIGHT_AUDIT_RUN_DETAIL_SQL,
  OTA_CONNECTION_LIST_SQL,
  OTA_SYNC_LOG_SQL,
} from "../sql/night-audit-queries.js";

// =====================================================
// HELPERS
// =====================================================

const toIsoString = (value: string | Date | null | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const formatDisplayLabel = (value: string | null | undefined): string => {
  if (!value || typeof value !== "string") {
    return "Unknown";
  }
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

// =====================================================
// BUSINESS DATE STATUS
// =====================================================

type BusinessDateRow = {
  business_date_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  business_date: Date | string;
  system_date: Date | string;
  date_status: string;
  night_audit_status: string | null;
  night_audit_started_at: Date | string | null;
  night_audit_completed_at: Date | string | null;
  is_locked: boolean | null;
  allow_postings: boolean | null;
  allow_check_ins: boolean | null;
  allow_check_outs: boolean | null;
  arrivals_count: number | null;
  departures_count: number | null;
  stayovers_count: number | null;
  total_revenue: string | null;
  audit_errors: number | null;
  audit_warnings: number | null;
  is_reconciled: boolean | null;
  notes: string | null;
};

export type GetBusinessDateStatusInput = {
  tenantId: string;
  propertyId: string;
};

export const getBusinessDateStatus = async (
  options: GetBusinessDateStatusInput,
): Promise<BusinessDateStatusResponse | null> => {
  const { rows } = await query<BusinessDateRow>(BUSINESS_DATE_STATUS_SQL, [
    options.tenantId,
    options.propertyId,
  ]);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0]!;
  return BusinessDateStatusResponseSchema.parse({
    business_date_id: row.business_date_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    business_date: toIsoString(row.business_date) ?? "",
    system_date: toIsoString(row.system_date) ?? "",
    date_status: row.date_status,
    date_status_display: formatDisplayLabel(row.date_status),
    night_audit_status: row.night_audit_status ?? undefined,
    night_audit_status_display: row.night_audit_status
      ? formatDisplayLabel(row.night_audit_status)
      : undefined,
    night_audit_started_at: toIsoString(row.night_audit_started_at) ?? undefined,
    night_audit_completed_at: toIsoString(row.night_audit_completed_at) ?? undefined,
    is_locked: row.is_locked ?? false,
    allow_postings: row.allow_postings ?? true,
    allow_check_ins: row.allow_check_ins ?? true,
    allow_check_outs: row.allow_check_outs ?? true,
    arrivals_count: row.arrivals_count ?? undefined,
    departures_count: row.departures_count ?? undefined,
    stayovers_count: row.stayovers_count ?? undefined,
    total_revenue: row.total_revenue ?? undefined,
    audit_errors: row.audit_errors ?? undefined,
    audit_warnings: row.audit_warnings ?? undefined,
    is_reconciled: row.is_reconciled ?? undefined,
    notes: row.notes ?? undefined,
  });
};

// =====================================================
// NIGHT AUDIT HISTORY
// =====================================================

type NightAuditRunRow = {
  audit_run_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  business_date: Date | string;
  next_business_date: Date | string | null;
  audit_status: string;
  execution_mode: string | null;
  is_test_run: boolean | null;
  started_at: Date | string;
  completed_at: Date | string | null;
  duration_seconds: number | null;
  total_steps: number;
  steps_completed: number;
  steps_failed: number;
  error_count: number | null;
  warning_count: number | null;
  is_successful: boolean | null;
  requires_attention: boolean | null;
  is_acknowledged: boolean | null;
  initiated_by: string;
  initiated_by_name: string | null;
  occupancy_percent: string | null;
  adr: string | null;
  revpar: string | null;
  total_revenue: string | null;
  total_rooms_sold: number | null;
};

const mapNightAuditRunRow = (row: NightAuditRunRow): NightAuditRunListItem => {
  return NightAuditRunListItemSchema.parse({
    audit_run_id: row.audit_run_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    business_date: toIsoString(row.business_date) ?? "",
    next_business_date: toIsoString(row.next_business_date) ?? undefined,
    audit_status: row.audit_status ?? "UNKNOWN",
    audit_status_display: formatDisplayLabel(row.audit_status),
    execution_mode: row.execution_mode ?? undefined,
    execution_mode_display: row.execution_mode ? formatDisplayLabel(row.execution_mode) : undefined,
    is_test_run: row.is_test_run ?? undefined,
    started_at: toIsoString(row.started_at) ?? "",
    completed_at: toIsoString(row.completed_at) ?? undefined,
    duration_seconds: row.duration_seconds ?? undefined,
    total_steps: row.total_steps,
    steps_completed: row.steps_completed,
    steps_failed: row.steps_failed,
    error_count: row.error_count ?? undefined,
    warning_count: row.warning_count ?? undefined,
    is_successful: row.is_successful ?? undefined,
    requires_attention: row.requires_attention ?? undefined,
    is_acknowledged: row.is_acknowledged ?? undefined,
    initiated_by: row.initiated_by,
    initiated_by_name: row.initiated_by_name ?? undefined,
    occupancy_percent: row.occupancy_percent ?? undefined,
    adr: row.adr ?? undefined,
    revpar: row.revpar ?? undefined,
    total_revenue: row.total_revenue ?? undefined,
    total_rooms_sold: row.total_rooms_sold ?? undefined,
  });
};

export type ListNightAuditHistoryInput = {
  tenantId: string;
  propertyId?: string;
  limit?: number;
  offset?: number;
};

export const listNightAuditHistory = async (
  options: ListNightAuditHistoryInput,
): Promise<NightAuditRunListItem[]> => {
  const { rows } = await query<NightAuditRunRow>(NIGHT_AUDIT_HISTORY_SQL, [
    options.limit ?? 50,
    options.tenantId,
    options.propertyId ?? null,
    options.offset ?? 0,
  ]);

  return rows.map(mapNightAuditRunRow);
};

// =====================================================
// NIGHT AUDIT RUN DETAIL
// =====================================================

type NightAuditStepRow = {
  audit_log_id: string;
  audit_run_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  business_date: Date | string;
  next_business_date: Date | string | null;
  started_at: Date | string;
  completed_at: Date | string | null;
  duration_seconds: number | null;
  audit_status: string;
  step_number: number;
  step_name: string;
  step_category: string | null;
  step_status: string;
  step_started_at: Date | string | null;
  step_completed_at: Date | string | null;
  step_duration_ms: number | null;
  records_processed: number | null;
  records_succeeded: number | null;
  records_failed: number | null;
  records_skipped: number | null;
  amount_posted: string | null;
  transactions_created: number | null;
  error_count: number | null;
  warning_count: number | null;
  error_message: string | null;
  initiated_by: string;
  initiated_by_name: string | null;
  execution_mode: string | null;
  is_test_run: boolean | null;
  occupancy_percent: string | null;
  adr: string | null;
  revpar: string | null;
  total_revenue: string | null;
  total_rooms_sold: number | null;
  is_successful: boolean | null;
  requires_attention: boolean | null;
  is_acknowledged: boolean | null;
  reports_generated: string[] | null;
  actions_taken: string[] | null;
  notes: string | null;
  resolution_notes: string | null;
};

export type GetNightAuditRunDetailInput = {
  runId: string;
  tenantId: string;
};

export const getNightAuditRunDetail = async (
  options: GetNightAuditRunDetailInput,
): Promise<NightAuditRunDetailResponse | null> => {
  const { rows } = await query<NightAuditStepRow>(NIGHT_AUDIT_RUN_DETAIL_SQL, [
    options.runId,
    options.tenantId,
  ]);

  if (rows.length === 0) {
    return null;
  }

  // First row contains run-level data
  const firstRow = rows[0]!;

  // Map all steps
  const steps: NightAuditStep[] = rows.map((row) =>
    NightAuditStepSchema.parse({
      step_number: row.step_number,
      step_name: row.step_name,
      step_category: row.step_category ?? undefined,
      step_status: row.step_status,
      step_status_display: formatDisplayLabel(row.step_status),
      step_started_at: toIsoString(row.step_started_at) ?? undefined,
      step_completed_at: toIsoString(row.step_completed_at) ?? undefined,
      step_duration_ms: row.step_duration_ms ?? undefined,
      records_processed: row.records_processed ?? undefined,
      records_succeeded: row.records_succeeded ?? undefined,
      records_failed: row.records_failed ?? undefined,
      records_skipped: row.records_skipped ?? undefined,
      amount_posted: row.amount_posted ?? undefined,
      transactions_created: row.transactions_created ?? undefined,
      error_count: row.error_count ?? undefined,
      warning_count: row.warning_count ?? undefined,
      error_message: row.error_message ?? undefined,
    }),
  );

  // Build run detail response
  return NightAuditRunDetailResponseSchema.parse({
    audit_run_id: firstRow.audit_run_id,
    tenant_id: firstRow.tenant_id,
    property_id: firstRow.property_id,
    property_name: firstRow.property_name ?? undefined,
    business_date: toIsoString(firstRow.business_date) ?? "",
    next_business_date: toIsoString(firstRow.next_business_date) ?? undefined,
    audit_status: firstRow.audit_status ?? "UNKNOWN",
    audit_status_display: formatDisplayLabel(firstRow.audit_status),
    execution_mode: firstRow.execution_mode ?? undefined,
    execution_mode_display: firstRow.execution_mode
      ? formatDisplayLabel(firstRow.execution_mode)
      : undefined,
    is_test_run: firstRow.is_test_run ?? undefined,
    started_at: toIsoString(firstRow.started_at) ?? "",
    completed_at: toIsoString(firstRow.completed_at) ?? undefined,
    duration_seconds: firstRow.duration_seconds ?? undefined,
    total_steps: rows.length,
    steps_completed: rows.filter((r) => r.step_status === "COMPLETED").length,
    steps_failed: rows.filter((r) => r.step_status === "FAILED").length,
    error_count: rows.reduce((sum, r) => sum + (r.error_count ?? 0), 0),
    warning_count: rows.reduce((sum, r) => sum + (r.warning_count ?? 0), 0),
    is_successful: firstRow.is_successful ?? undefined,
    requires_attention: firstRow.requires_attention ?? undefined,
    is_acknowledged: firstRow.is_acknowledged ?? undefined,
    initiated_by: firstRow.initiated_by,
    initiated_by_name: firstRow.initiated_by_name ?? undefined,
    occupancy_percent: firstRow.occupancy_percent ?? undefined,
    adr: firstRow.adr ?? undefined,
    revpar: firstRow.revpar ?? undefined,
    total_revenue: firstRow.total_revenue ?? undefined,
    total_rooms_sold: firstRow.total_rooms_sold ?? undefined,
    steps: steps,
    reports_generated: firstRow.reports_generated ?? undefined,
    actions_taken: firstRow.actions_taken ?? undefined,
    notes: firstRow.notes ?? undefined,
    resolution_notes: firstRow.resolution_notes ?? undefined,
  });
};

// =====================================================
// OTA CONNECTIONS
// =====================================================

type OtaConnectionRow = {
  ota_connection_id: string;
  tenant_id: string;
  property_id: string | null;
  property_name: string | null;
  channel_code: string;
  channel_name: string;
  channel_type: string | null;
  connection_status: string;
  is_active: boolean | null;
  is_two_way_sync: boolean | null;
  last_sync_at: Date | string | null;
  last_sync_status: string | null;
  last_error_message: string | null;
  sync_frequency_minutes: number | null;
  rooms_mapped: number | null;
  rates_mapped: number | null;
  pending_reservations: number | null;
  api_version: string | null;
  created_at: Date | string;
  updated_at: Date | string | null;
};

const mapOtaConnectionRow = (row: OtaConnectionRow): OtaConnectionListItem => {
  return OtaConnectionListItemSchema.parse({
    ota_connection_id: row.ota_connection_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id ?? undefined,
    property_name: row.property_name ?? undefined,
    channel_code: row.channel_code,
    channel_name: row.channel_name,
    channel_type: row.channel_type ?? undefined,
    connection_status: row.connection_status ?? "DISCONNECTED",
    connection_status_display: formatDisplayLabel(row.connection_status),
    is_active: row.is_active ?? false,
    is_two_way_sync: row.is_two_way_sync ?? false,
    last_sync_at: toIsoString(row.last_sync_at) ?? undefined,
    last_sync_status: row.last_sync_status ?? undefined,
    last_sync_status_display: row.last_sync_status
      ? formatDisplayLabel(row.last_sync_status)
      : undefined,
    last_error_message: row.last_error_message ?? undefined,
    sync_frequency_minutes: row.sync_frequency_minutes ?? undefined,
    rooms_mapped: row.rooms_mapped ?? undefined,
    rates_mapped: row.rates_mapped ?? undefined,
    pending_reservations: row.pending_reservations ?? undefined,
    api_version: row.api_version ?? undefined,
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at) ?? undefined,
  });
};

export type ListOtaConnectionsInput = {
  tenantId: string;
  propertyId?: string;
  connectionStatus?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
};

export const listOtaConnections = async (
  options: ListOtaConnectionsInput,
): Promise<OtaConnectionListItem[]> => {
  const { rows } = await query<OtaConnectionRow>(OTA_CONNECTION_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.connectionStatus ?? null,
    options.isActive ?? null,
    options.offset ?? 0,
  ]);

  return rows.map(mapOtaConnectionRow);
};

// =====================================================
// OTA SYNC HISTORY
// =====================================================

type OtaSyncLogRow = {
  sync_log_id: string;
  ota_connection_id: string;
  sync_type: string;
  sync_direction: string;
  sync_status: string;
  started_at: Date | string;
  completed_at: Date | string | null;
  duration_ms: number | null;
  records_processed: number | null;
  records_created: number | null;
  records_updated: number | null;
  records_failed: number | null;
  error_message: string | null;
  triggered_by: string | null;
};

export type ListOtaSyncLogsInput = {
  connectionId: string;
  tenantId: string;
  limit?: number;
  offset?: number;
};

export const listOtaSyncLogs = async (options: ListOtaSyncLogsInput): Promise<OtaSyncLog[]> => {
  const { rows } = await query<OtaSyncLogRow>(OTA_SYNC_LOG_SQL, [
    options.connectionId,
    options.tenantId,
    options.limit ?? 50,
    options.offset ?? 0,
  ]);

  return rows.map((row) =>
    OtaSyncLogSchema.parse({
      sync_log_id: row.sync_log_id,
      ota_connection_id: row.ota_connection_id,
      sync_type: row.sync_type,
      sync_direction: row.sync_direction,
      sync_status: row.sync_status,
      sync_status_display: formatDisplayLabel(row.sync_status),
      started_at: toIsoString(row.started_at) ?? "",
      completed_at: toIsoString(row.completed_at) ?? undefined,
      duration_ms: row.duration_ms ?? undefined,
      records_processed: row.records_processed ?? undefined,
      records_created: row.records_created ?? undefined,
      records_updated: row.records_updated ?? undefined,
      records_failed: row.records_failed ?? undefined,
      error_message: row.error_message ?? undefined,
      triggered_by: row.triggered_by ?? undefined,
    }),
  );
};
