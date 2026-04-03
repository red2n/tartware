import {
  type AllotmentListItem,
  AllotmentListItemSchema,
  type AllotmentRow,
  type GetAllotmentInput,
  type ListAllotmentsInput,
} from "@tartware/schemas";

import { query } from "../../lib/db.js";
import { ALLOTMENT_BY_ID_SQL, ALLOTMENT_LIST_SQL } from "../../sql/booking-config/allotment.js";

import { formatDisplayLabel, toIsoString, toNumber } from "./common.js";

// =====================================================
// ALLOTMENT SERVICE
// =====================================================

const mapAllotmentRow = (row: AllotmentRow): AllotmentListItem => {
  return AllotmentListItemSchema.parse({
    allotment_id: row.allotment_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    allotment_code: row.allotment_code,
    allotment_name: row.allotment_name,
    allotment_type: row.allotment_type?.toLowerCase() ?? "group",
    allotment_type_display: formatDisplayLabel(row.allotment_type),
    allotment_status: row.allotment_status?.toLowerCase() ?? "tentative",
    allotment_status_display: formatDisplayLabel(row.allotment_status),
    start_date: (toIsoString(row.start_date) ?? "").split("T")[0],
    end_date: (toIsoString(row.end_date) ?? "").split("T")[0],
    cutoff_date: row.cutoff_date ? (toIsoString(row.cutoff_date) ?? "").split("T")[0] : null,
    room_type_id: row.room_type_id ?? undefined,
    total_rooms_blocked: row.total_rooms_blocked ?? 0,
    total_room_nights: row.total_room_nights,
    rooms_per_night: row.rooms_per_night,
    rooms_picked_up: row.rooms_picked_up ?? 0,
    rooms_available: row.rooms_available,
    pickup_percentage: toNumber(row.pickup_percentage) ?? 0,
    rate_type: row.rate_type,
    contracted_rate: toNumber(row.contracted_rate),
    total_expected_revenue: toNumber(row.total_expected_revenue),
    actual_revenue: toNumber(row.actual_revenue),
    currency_code: row.currency_code ?? "USD",
    account_name: row.account_name,
    account_type: row.account_type,
    billing_type: row.billing_type ?? "INDIVIDUAL",
    contact_name: row.contact_name,
    contact_email: row.contact_email,
    deposit_required: Boolean(row.deposit_required),
    attrition_clause: Boolean(row.attrition_clause),
    attrition_percentage: toNumber(row.attrition_percentage),
    guaranteed_rooms: row.guaranteed_rooms,
    is_vip: Boolean(row.is_vip),
    priority_level: row.priority_level ?? 0,
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoString(row.updated_at),
  });
};

export const listAllotments = async (
  options: ListAllotmentsInput,
): Promise<AllotmentListItem[]> => {
  const { rows } = await query<AllotmentRow>(ALLOTMENT_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.status ?? null,
    options.allotmentType ?? null,
    options.startDateFrom ?? null,
    options.endDateTo ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapAllotmentRow);
};

export const getAllotmentById = async (
  options: GetAllotmentInput,
): Promise<AllotmentListItem | null> => {
  const { rows } = await query<AllotmentRow>(ALLOTMENT_BY_ID_SQL, [
    options.allotmentId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapAllotmentRow(row);
};
