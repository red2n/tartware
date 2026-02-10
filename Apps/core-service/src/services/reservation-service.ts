import {
  type ReservationListItem as SchemaReservationListItem,
  ReservationListItemSchema as SchemaReservationListItemSchema,
  ReservationDetailSchema,
  type ReservationDetail,
  CheckInBriefSchema,
  type CheckInBrief,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import { RESERVATION_LIST_SQL } from "../sql/reservation-queries.js";
import { toNonNegativeInt, toNumberOrFallback } from "../utils/numbers.js";

export { ReservationDetailSchema, type ReservationDetail };
export { CheckInBriefSchema, type CheckInBrief };

/**
 * S23: Aggregate pre-check-in guest recognition data.
 * Combines reservation details, guest profile, preferences, and alerts
 * into a single response for front-desk staff.
 */
export const getCheckInBrief = async (options: {
  tenantId: string;
  reservationId: string;
}): Promise<CheckInBrief | null> => {
  // 1. Fetch reservation + guest in one join
  const { rows } = await query<Record<string, unknown>>(
    `SELECT
       r.id AS reservation_id,
       r.guest_id,
       r.guest_name,
       r.guest_email,
       r.guest_phone,
       r.room_number,
       rt.type_name AS room_type,
       r.check_in_date,
       r.check_out_date,
       r.special_requests,
       r.internal_notes,
       r.reservation_type,
       g.vip_status,
       g.loyalty_tier,
       g.loyalty_points,
       g.is_blacklisted,
       COALESCE(g.total_bookings, 0) AS total_stays,
       COALESCE(g.total_nights, 0)   AS total_nights,
       COALESCE(g.total_revenue, 0)  AS total_revenue,
       g.last_stay_date
     FROM reservations r
     LEFT JOIN guests g ON r.guest_id = g.id AND g.tenant_id = r.tenant_id
     LEFT JOIN room_types rt ON r.room_type_id = rt.id
     WHERE r.id = $1 AND r.tenant_id = $2
       AND COALESCE(r.is_deleted, false) = false
     LIMIT 1`,
    [options.reservationId, options.tenantId],
  );

  const row = rows[0];
  if (!row) return null;

  const guestId = row.guest_id as string | null;

  // 2. Fetch guest preferences (if guest exists)
  let preferences: CheckInBrief["preferences"] = [];
  if (guestId) {
    const { rows: prefRows } = await query<Record<string, unknown>>(
      `SELECT preference_category, preference_type, preference_value,
              priority, is_mandatory, is_special_request
       FROM guest_preferences
       WHERE guest_id = $1 AND tenant_id = $2
         AND COALESCE(is_deleted, false) = false
       ORDER BY priority DESC NULLS LAST
       LIMIT 50`,
      [guestId, options.tenantId],
    );
    preferences = prefRows.map((p) => ({
      category: p.preference_category as string | null,
      preference_type: p.preference_type as string | null,
      preference_value: p.preference_value as string | null,
      priority: p.priority != null ? Number(p.priority) : null,
      is_mandatory: (p.is_mandatory as boolean) ?? false,
      is_special_request: (p.is_special_request as boolean) ?? false,
    }));
  }

  // 3. Fetch guest notes — separate alerts from informational notes
  let alerts: CheckInBrief["alerts"] = [];
  let notes: CheckInBrief["notes"] = [];
  if (guestId) {
    const { rows: noteRows } = await query<Record<string, unknown>>(
      `SELECT note_id, note_type, note_text, is_alert, alert_level, status
       FROM guest_notes
       WHERE guest_id = $1 AND tenant_id = $2
         AND (show_on_checkin = true OR is_alert = true OR show_at_frontdesk = true)
         AND COALESCE(is_deleted, false) = false
       ORDER BY is_alert DESC, alert_level ASC NULLS LAST
       LIMIT 50`,
      [guestId, options.tenantId],
    );

    for (const n of noteRows) {
      const entry = {
        note_id: String(n.note_id),
        note_type: n.note_type as string | null,
        note_text: n.note_text as string | null,
        alert_level: n.alert_level as string | null,
        is_alert: (n.is_alert as boolean) ?? false,
        status: n.status as string | null,
      };
      if (entry.is_alert) {
        alerts.push(entry);
      } else {
        notes.push(entry);
      }
    }
  }

  return CheckInBriefSchema.parse({
    reservation_id: String(row.reservation_id),
    guest_id: guestId,
    guest_name: String(row.guest_name ?? "Unknown Guest"),
    guest_email: row.guest_email as string | null,
    guest_phone: row.guest_phone as string | null,
    vip_status: row.vip_status as string | null,
    loyalty_tier: row.loyalty_tier as string | null,
    loyalty_points: row.loyalty_points != null ? Number(row.loyalty_points) : null,
    is_blacklisted: (row.is_blacklisted as boolean) ?? false,
    total_stays: toNonNegativeInt(row.total_stays, 0),
    total_nights: toNonNegativeInt(row.total_nights, 0),
    total_revenue: toNumberOrFallback(row.total_revenue, 0),
    last_stay_date: row.last_stay_date
      ? (row.last_stay_date instanceof Date
          ? row.last_stay_date.toISOString()
          : String(row.last_stay_date))
      : null,
    room_number: row.room_number as string | null,
    room_type: row.room_type as string | null,
    check_in_date: String(row.check_in_date),
    check_out_date: String(row.check_out_date),
    special_requests: row.special_requests as string | null,
    internal_notes: row.internal_notes as string | null,
    reservation_type: row.reservation_type as string | null,
    preferences,
    alerts,
    notes,
  });
};

/**
 * Re-export for backward compatibility.
 */
export const ReservationListItemSchema = SchemaReservationListItemSchema;
export type ReservationListItem = SchemaReservationListItem;

type ReservationListRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  guest_id: string | null;
  room_type_id: string | null;
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
  if (!value || typeof value !== "string") {
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
  if (!value || typeof value !== "string") {
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

/**
 * List reservations with filter and search support.
 */
export const listReservations = async (options: {
  limit?: number;
  offset?: number;
  tenantId: string;
  propertyId?: string;
  status?: string;
  search?: string;
}): Promise<ReservationListItem[]> => {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
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
    offset,
  ]);

  return rows.map(mapRowToReservation);
};

/**
 * Fetch a single reservation by ID with folio + status history.
 */
export const getReservationById = async (options: {
  tenantId: string;
  reservationId: string;
}): Promise<ReservationDetail | null> => {
  const { rows } = await query<Record<string, unknown>>(
    `SELECT
       r.id, r.tenant_id, r.property_id, p.property_name,
       r.guest_id, r.guest_name, r.guest_email, r.guest_phone,
       r.room_type_id, rt.type_name AS room_type_name,
       r.rate_id, r.confirmation_number, r.reservation_type,
       r.check_in_date, r.check_out_date, r.booking_date,
       r.actual_check_in, r.actual_check_out,
       r.room_number, r.number_of_adults, r.number_of_children,
       r.room_rate, r.total_amount, r.tax_amount, r.discount_amount,
       r.paid_amount, r.balance_due, r.currency,
       r.status, r.source, r.channel_reference,
       r.guarantee_type, r.credit_card_last4,
       r.special_requests, r.internal_notes,
       r.cancellation_date, r.cancellation_reason, r.cancellation_fee,
       r.is_no_show, r.no_show_date, r.no_show_fee,
       r.promo_code,
       r.created_at, r.updated_at, r.version,
       GREATEST(1, r.check_out_date::date - r.check_in_date::date) AS nights
     FROM public.reservations r
     LEFT JOIN public.properties p ON r.property_id = p.id
     LEFT JOIN public.room_types rt ON r.room_type_id = rt.id
     WHERE r.id = $1::uuid
       AND r.tenant_id = $2::uuid
       AND COALESCE(r.is_deleted, false) = false
     LIMIT 1`,
    [options.reservationId, options.tenantId],
  );

  const row = rows[0];
  if (!row) return null;

  const { status: statusNorm, display } = normalizeStatus(row.status as string);

  // Fetch folio
  const { rows: folioRows } = await query<Record<string, unknown>>(
    `SELECT folio_id, folio_status, total_charges, total_payments, total_credits, balance
     FROM public.folios
     WHERE reservation_id = $1::uuid AND tenant_id = $2::uuid
     LIMIT 1`,
    [options.reservationId, options.tenantId],
  );

  // Fetch status history
  const { rows: historyRows } = await query<Record<string, unknown>>(
    `SELECT previous_status, new_status, change_reason, changed_by, changed_at
     FROM public.reservation_status_history
     WHERE reservation_id = $1::uuid AND tenant_id = $2::uuid
     ORDER BY changed_at ASC
     LIMIT 50`,
    [options.reservationId, options.tenantId],
  );

  const folio = folioRows[0]
    ? {
        folio_id: String(folioRows[0].folio_id),
        folio_status: String(folioRows[0].folio_status),
        total_charges: toNumberOrFallback(folioRows[0].total_charges, 0),
        total_payments: toNumberOrFallback(folioRows[0].total_payments, 0),
        total_credits: toNumberOrFallback(folioRows[0].total_credits, 0),
        balance: toNumberOrFallback(folioRows[0].balance, 0),
      }
    : undefined;

  const statusHistory = historyRows.map((h) => ({
    previous_status: String(h.previous_status ?? ""),
    new_status: String(h.new_status ?? ""),
    change_reason: h.change_reason ? String(h.change_reason) : undefined,
    changed_by: String(h.changed_by ?? "system"),
    changed_at: toStringDate(h.changed_at as string | Date | null) ?? "",
  }));

  return ReservationDetailSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    guest_id: row.guest_id ?? undefined,
    guest_name: row.guest_name ?? undefined,
    guest_email: row.guest_email ?? undefined,
    guest_phone: row.guest_phone ?? undefined,
    room_type_id: row.room_type_id ?? undefined,
    room_type_name: row.room_type_name ?? undefined,
    rate_id: row.rate_id ?? undefined,
    confirmation_number: row.confirmation_number,
    reservation_type: row.reservation_type ?? undefined,
    check_in_date: toStringDate(row.check_in_date as string | Date | null) ?? "",
    check_out_date: toStringDate(row.check_out_date as string | Date | null) ?? "",
    booking_date: toStringDate(row.booking_date as string | Date | null),
    actual_check_in: toStringDate(row.actual_check_in as string | Date | null),
    actual_check_out: toStringDate(row.actual_check_out as string | Date | null),
    nights: toNonNegativeInt(row.nights, 1) || 1,
    room_number: row.room_number ?? undefined,
    number_of_adults: toNonNegativeInt(row.number_of_adults, 1),
    number_of_children: toNonNegativeInt(row.number_of_children, 0),
    room_rate: toNumberOrFallback(row.room_rate, 0),
    total_amount: toNumberOrFallback(row.total_amount, 0),
    tax_amount: toNumberOrFallback(row.tax_amount, 0),
    discount_amount: toNumberOrFallback(row.discount_amount, 0),
    paid_amount: toNumberOrFallback(row.paid_amount, 0),
    balance_due: toNumberOrFallback(row.balance_due, 0),
    currency: row.currency ?? "USD",
    status: statusNorm,
    status_display: display,
    source: normalizeSource(row.source as string | null),
    channel_reference: row.channel_reference ?? undefined,
    guarantee_type: row.guarantee_type ?? undefined,
    credit_card_last4: row.credit_card_last4 ?? undefined,
    special_requests: row.special_requests ?? undefined,
    internal_notes: row.internal_notes ?? undefined,
    cancellation_date: toStringDate(row.cancellation_date as string | Date | null),
    cancellation_reason: row.cancellation_reason ?? undefined,
    cancellation_fee:
      row.cancellation_fee != null ? toNumberOrFallback(row.cancellation_fee) : undefined,
    is_no_show: row.is_no_show ?? false,
    no_show_date: toStringDate(row.no_show_date as string | Date | null),
    no_show_fee: row.no_show_fee != null ? toNumberOrFallback(row.no_show_fee) : undefined,
    promo_code: row.promo_code ?? undefined,
    folio,
    status_history: statusHistory.length > 0 ? statusHistory : undefined,
    created_at: toStringDate(row.created_at as string | Date | null) ?? "",
    updated_at: toStringDate(row.updated_at as string | Date | null),
    version: row.version ? String(row.version) : "0",
  });
};
