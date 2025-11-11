import { z } from "zod";

import { query } from "../lib/db.js";
import { RESERVATION_LIST_SQL } from "../sql/reservation-queries.js";
import { toNonNegativeInt, toNumberOrFallback } from "../utils/numbers.js";

export const ReservationListItemSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
  property_name: z.string().optional(),
  guest_id: z.string().uuid().optional(),
  room_type_id: z.string().uuid().optional(),
  room_type_name: z.string().optional(),
  confirmation_number: z.string(),
  check_in_date: z.string(),
  check_out_date: z.string(),
  nights: z.number().int().positive(),
  status: z.string(),
  status_display: z.string(),
  source: z.string().optional(),
  guest_name: z.string(),
  guest_email: z.string(),
  guest_phone: z.string().optional(),
  room_number: z.string().optional(),
  total_amount: z.number(),
  paid_amount: z.number().optional(),
  balance_due: z.number().optional(),
  currency: z.string(),
  booking_date: z.string().optional(),
  actual_check_in: z.string().optional(),
  actual_check_out: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  notes: z.string().optional(),
  version: z.string(),
});

export type ReservationListItem = z.infer<typeof ReservationListItemSchema>;

type ReservationListRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  guest_id: string | null;
  room_type_id: string | null;
  room_type_name: string | null;
  room_type_name: string | null;
  confirmation_number: string;
  check_in_date: string | Date | null;
  check_out_date: string | Date | null;
  booking_date: string | Date | null;
  actual_check_in: string | Date | null;
  actual_check_out: string | Date | null;
  room_number: string | null;
  number_of_adults: number | string | null;
  number_of_children: number | string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  balance_due: number | string | null;
  currency: string | null;
  status: string | null;
  source: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  special_requests: string | null;
  internal_notes: string | null;
  created_at: string | Date;
  updated_at: string | Date | null;
  version: bigint | null;
  nights: number | string | null;
};

const normalizeStatus = (value: string | null): { status: string; display: string } => {
  if (!value) {
    return { status: "unknown", display: "Unknown" };
  }
  const normalized = value.toLowerCase();
  const display = normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return { status: normalized, display };
};

const normalizeSource = (value: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  return value.toLowerCase();
};

const toStringDate = (value: string | Date | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const mapRowToReservation = (row: ReservationListRow): ReservationListItem => {
  const { status, display } = normalizeStatus(row.status);

  const parsed = ReservationListItemSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    guest_id: row.guest_id ?? undefined,
    room_type_id: row.room_type_id ?? undefined,
    room_type_name: row.room_type_name ?? undefined,
    confirmation_number: row.confirmation_number,
    check_in_date: toStringDate(row.check_in_date) ?? "",
    check_out_date: toStringDate(row.check_out_date) ?? "",
    booking_date: toStringDate(row.booking_date),
    actual_check_in: toStringDate(row.actual_check_in),
    actual_check_out: toStringDate(row.actual_check_out),
    nights: toNonNegativeInt(row.nights, 1) || 1,
    status,
    status_display: display,
    source: normalizeSource(row.source),
    guest_name: row.guest_name,
    guest_email: row.guest_email,
    guest_phone: row.guest_phone ?? undefined,
    room_number: row.room_number ?? undefined,
    total_amount: toNumberOrFallback(row.total_amount),
    paid_amount: toNumberOrFallback(row.paid_amount, 0),
    balance_due: toNumberOrFallback(row.balance_due, 0),
    currency: row.currency ?? "USD",
    created_at: toStringDate(row.created_at) ?? "",
    updated_at: toStringDate(row.updated_at),
    notes: row.internal_notes ?? row.special_requests ?? undefined,
    version: row.version ? row.version.toString() : "0",
  });

  return parsed;
};

export const listReservations = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  status?: string;
  search?: string;
}): Promise<ReservationListItem[]> => {
  const limit = options.limit ?? 100;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const status = options.status ? options.status.trim().toUpperCase() : null;
  const search = options.search ? `%${options.search.trim()}%` : null;

  const { rows } = await query<ReservationListRow>(RESERVATION_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    status,
    search,
  ]);

  return rows.map(mapRowToReservation);
};
