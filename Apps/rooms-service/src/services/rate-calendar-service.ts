/**
 * DEV DOC
 * Module: services/rate-calendar-service.ts
 * Purpose: Rate calendar day-level pricing operations
 * Ownership: rooms-service
 */

import type {
  RateCalendarBulkUpsertBody,
  RateCalendarItem,
  RateCalendarRangeFillBody,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import { RATE_CALENDAR_LIST_SQL, RATE_CALENDAR_UPSERT_SQL } from "../sql/rate-calendar-queries.js";

type CalendarRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  room_type_id: string;
  rate_id: string;
  stay_date: string | Date;
  rate_amount: string | number;
  currency: string;
  single_rate: string | number | null;
  double_rate: string | number | null;
  extra_person: string | number | null;
  extra_child: string | number | null;
  status: string;
  closed_to_arrival: boolean;
  closed_to_departure: boolean;
  min_length_of_stay: number | null;
  max_length_of_stay: number | null;
  min_advance_days: number | null;
  max_advance_days: number | null;
  rooms_to_sell: number | null;
  rooms_sold: number;
  source: string;
};

function toDateStr(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function toNum(value: string | number | null): number | undefined {
  if (value === null || value === undefined) return undefined;
  return Number(value);
}

function mapRow(row: CalendarRow): RateCalendarItem {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    room_type_id: row.room_type_id,
    rate_id: row.rate_id,
    stay_date: toDateStr(row.stay_date),
    rate_amount: Number(row.rate_amount),
    currency: row.currency,
    single_rate: toNum(row.single_rate),
    double_rate: toNum(row.double_rate),
    extra_person: toNum(row.extra_person),
    extra_child: toNum(row.extra_child),
    status: row.status,
    closed_to_arrival: row.closed_to_arrival,
    closed_to_departure: row.closed_to_departure,
    min_length_of_stay: row.min_length_of_stay ?? undefined,
    max_length_of_stay: row.max_length_of_stay ?? undefined,
    min_advance_days: row.min_advance_days ?? undefined,
    max_advance_days: row.max_advance_days ?? undefined,
    rooms_to_sell: row.rooms_to_sell ?? undefined,
    rooms_sold: row.rooms_sold,
    source: row.source,
  };
}

/** List rate calendar entries for a date range with optional filters. */
export async function listRateCalendar(opts: {
  tenantId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  roomTypeId?: string;
  rateId?: string;
  status?: string;
}): Promise<RateCalendarItem[]> {
  let sql = RATE_CALENDAR_LIST_SQL;
  const params: unknown[] = [opts.tenantId, opts.propertyId, opts.startDate, opts.endDate];
  let paramIdx = 5;

  if (opts.roomTypeId) {
    sql += ` AND rc.room_type_id = $${paramIdx}`;
    params.push(opts.roomTypeId);
    paramIdx++;
  }
  if (opts.rateId) {
    sql += ` AND rc.rate_id = $${paramIdx}`;
    params.push(opts.rateId);
    paramIdx++;
  }
  if (opts.status) {
    sql += ` AND rc.status = $${paramIdx}`;
    params.push(opts.status);
    paramIdx++;
  }

  sql += " ORDER BY rc.room_type_id, rc.rate_id, rc.stay_date";

  const result = await query<CalendarRow>(sql, params);
  return result.rows.map(mapRow);
}

/** Bulk upsert individual day entries. */
export async function bulkUpsertRateCalendar(
  body: RateCalendarBulkUpsertBody,
  userId?: string,
): Promise<RateCalendarItem[]> {
  const results: RateCalendarItem[] = [];

  for (const day of body.days) {
    const result = await query<CalendarRow>(RATE_CALENDAR_UPSERT_SQL, [
      body.tenant_id,
      body.property_id,
      body.room_type_id,
      body.rate_id,
      day.stay_date,
      day.rate_amount,
      body.currency,
      day.single_rate ?? null,
      day.double_rate ?? null,
      day.extra_person ?? null,
      day.extra_child ?? null,
      day.status ?? "OPEN",
      day.closed_to_arrival ?? false,
      day.closed_to_departure ?? false,
      day.min_length_of_stay ?? null,
      day.max_length_of_stay ?? null,
      body.source,
      userId ?? null,
    ]);
    if (result.rows[0]) {
      results.push(mapRow(result.rows[0]));
    }
  }

  return results;
}

/** Fill a date range with a uniform rate. */
export async function rangeFillRateCalendar(
  body: RateCalendarRangeFillBody,
  userId?: string,
): Promise<RateCalendarItem[]> {
  const start = new Date(`${body.start_date}T00:00:00`);
  const end = new Date(`${body.end_date}T00:00:00`);
  const results: RateCalendarItem[] = [];

  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const result = await query<CalendarRow>(RATE_CALENDAR_UPSERT_SQL, [
      body.tenant_id,
      body.property_id,
      body.room_type_id,
      body.rate_id,
      dateStr,
      body.rate_amount,
      body.currency,
      null, // single_rate
      null, // double_rate
      null, // extra_person
      null, // extra_child
      body.status,
      body.closed_to_arrival,
      body.closed_to_departure,
      body.min_length_of_stay ?? null,
      body.max_length_of_stay ?? null,
      body.source,
      userId ?? null,
    ]);
    if (result.rows[0]) {
      results.push(mapRow(result.rows[0]));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return results;
}
