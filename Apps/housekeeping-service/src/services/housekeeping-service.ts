import {
  type HousekeepingTaskListItem,
  HousekeepingTaskListItemSchema,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import { HOUSEKEEPING_TASK_LIST_SQL } from "../sql/housekeeping-queries.js";
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

const normalizeStatus = (
  value: string | null,
): { value: string; display: string } => {
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
}): Promise<HousekeepingTask[]> => {
  const limit = options.limit ?? 200;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const status = options.status ? options.status.trim().toUpperCase() : null;
  const scheduledDate = options.scheduledDate ?? null;

  const { rows } = await query<HousekeepingTaskRow>(
    HOUSEKEEPING_TASK_LIST_SQL,
    [limit, tenantId, propertyId, status, scheduledDate],
  );

  return rows.map(mapRowToTask);
};
