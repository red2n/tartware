import type { DemandCalendarListItem } from "@tartware/schemas";
import { query } from "../lib/db.js";
import { toDateString, toIsoString, toNumber } from "../lib/row-mappers.js";
import { DEMAND_CALENDAR_LIST_SQL, DEMAND_CALENDAR_UPSERT_SQL } from "../sql/pricing-queries.js";

// ============================================================================
// DEMAND CALENDAR
// ============================================================================

type DemandCalendarRow = {
  calendar_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  calendar_date: string | Date;
  day_of_week: string | null;
  demand_level: string | null;
  occupancy_forecast: number | string | null;
  booking_pace: number | string | null;
  events: unknown;
  notes: string | null;
  created_at: string | Date;
  updated_at: string | Date | null;
};

export type { DemandCalendarListItem };

const mapRowToDemandCalendar = (row: DemandCalendarRow): DemandCalendarListItem => ({
  calendar_id: row.calendar_id,
  tenant_id: row.tenant_id,
  property_id: row.property_id,
  property_name: row.property_name ?? undefined,
  calendar_date: toDateString(row.calendar_date) ?? "",
  day_of_week: row.day_of_week ?? undefined,
  demand_level: row.demand_level ?? undefined,
  occupancy_forecast: row.occupancy_forecast != null ? toNumber(row.occupancy_forecast) : undefined,
  booking_pace: row.booking_pace != null ? toNumber(row.booking_pace) : undefined,
  notes: row.notes ?? undefined,
  created_at: toIsoString(row.created_at) ?? "",
  updated_at: toIsoString(row.updated_at),
});

export const listDemandCalendar = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  dateFrom?: string;
  dateTo?: string;
  offset?: number;
}): Promise<DemandCalendarListItem[]> => {
  const { rows } = await query<DemandCalendarRow>(DEMAND_CALENDAR_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.dateFrom ?? null,
    options.dateTo ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapRowToDemandCalendar);
};

export const upsertDemandCalendarEntry = async (
  tenantId: string,
  propertyId: string,
  calendarDate: string,
  demandLevel: string,
  notes: string | null,
  actorId: string | null,
): Promise<{ calendarId: string }> => {
  const { rows } = await query<{ calendar_id: string }>(DEMAND_CALENDAR_UPSERT_SQL, [
    tenantId,
    propertyId,
    calendarDate,
    demandLevel,
    notes,
    actorId,
  ]);
  const row = rows[0];
  if (!row) throw new Error("UPSERT demand_calendar did not return a row");
  return { calendarId: row.calendar_id };
};
