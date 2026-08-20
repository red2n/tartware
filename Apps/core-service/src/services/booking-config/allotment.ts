import {
  ALLOTMENT_LEGAL_TRANSITIONS,
  type AllotmentListItem,
  AllotmentListItemSchema,
  type AllotmentRow,
  type AllotmentStatus,
  type AllotmentWriteInput,
  type GetAllotmentInput,
  type ListAllotmentsInput,
} from "@tartware/schemas";

import { query } from "../../lib/db.js";
import { ALLOTMENT_BY_ID_SQL, ALLOTMENT_LIST_SQL } from "../../sql/booking-config/allotment.js";

import {
  formatDisplayLabel,
  isUniqueViolationOn,
  ReferenceCodeConflictError,
  toIsoString,
  toNumber,
} from "./common.js";

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
    // Stored case, not folded. `allotments_allotment_status_check` holds
    // 'TENTATIVE'…'CANCELLED' and the type check 'GROUP'…'CONFERENCE'; folding
    // them to lower case here meant the read model and the table disagreed, so
    // a status posted back from a screen could never match a transition rule.
    // One of the 25 fold sites ui-gaps/17-command-reachability.md counts.
    allotment_type: row.allotment_type ?? "GROUP",
    allotment_type_display: formatDisplayLabel(row.allotment_type),
    allotment_status: row.allotment_status ?? "TENTATIVE",
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

// =====================================================
// ALLOTMENT WRITES
// Step 4 of ui-gaps/16-booking-reference-data.md. Plain HTTP on the owning
// service per COV-18: one table, one service, no fan-out — the same shape as
// the booking sources and market segments beside it in `booking-config`.
//
// Deliberately *not* through availability-guard-service. The guard holds
// per-reservation TTL locks in `inventory_locks_shadow`; an allotment is a
// contracted block with a cutoff, an attrition clause and pickup tracking, and
// the guard has no way to express one. See the 2026-08-19 decision in
// ui-gaps/16 for the evidence, including why this is a distribution contract
// rather than the inventory side of a group booking (`group_room_blocks` is
// that, and it already has writers).
// =====================================================

/** Raised when a lifecycle move is not legal from the current status. */
export class AllotmentTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot move an allotment from ${from} to ${to}`);
    this.name = "AllotmentTransitionError";
  }
}

export const createAllotment = async (
  tenantId: string,
  input: AllotmentWriteInput,
  actorId?: string,
): Promise<AllotmentListItem | null> => {
  let rows: { allotment_id: string }[];

  try {
    ({ rows } = await query<{ allotment_id: string }>(
      `
        INSERT INTO public.allotments (
          tenant_id, property_id,
          allotment_code, allotment_name, allotment_type, allotment_status,
          start_date, end_date, cutoff_date, cutoff_days_prior,
          room_type_id, total_rooms_blocked, rooms_per_night,
          rate_type, contracted_rate, currency_code,
          account_name, account_type, billing_type,
          contact_name, contact_email, contact_phone, contact_company,
          booking_source_id, market_segment_id, channel,
          deposit_required, deposit_amount,
          attrition_clause, attrition_percentage, guaranteed_rooms, elastic_limit,
          commission_percentage, is_vip, priority_level,
          notes, internal_notes,
          created_by, updated_by
        ) VALUES (
          $1::uuid, $2::uuid,
          $3, $4, $5, COALESCE($6, 'TENTATIVE'),
          $7::date, $8::date, $9::date, $10,
          $11::uuid, $12, $13,
          $14, $15, COALESCE($16, 'USD'),
          $17, $18, COALESCE($19, 'INDIVIDUAL'),
          $20, $21, $22, $23,
          $24::uuid, $25::uuid, $26,
          COALESCE($27, false), $28,
          COALESCE($29, false), $30, $31, $32,
          $33, COALESCE($34, false), COALESCE($35, 0),
          $36, $37,
          $38::uuid, $38::uuid
        )
        RETURNING allotment_id
      `,
      [
        tenantId,
        input.propertyId ?? null,
        input.allotmentCode,
        input.allotmentName,
        input.allotmentType,
        input.allotmentStatus ?? null,
        input.startDate,
        input.endDate,
        input.cutoffDate ?? null,
        input.cutoffDaysPrior ?? null,
        input.roomTypeId ?? null,
        input.totalRoomsBlocked,
        input.roomsPerNight ?? null,
        input.rateType ?? null,
        input.contractedRate ?? null,
        input.currencyCode ?? null,
        input.accountName ?? null,
        input.accountType ?? null,
        input.billingType ?? null,
        input.contactName ?? null,
        input.contactEmail ?? null,
        input.contactPhone ?? null,
        input.contactCompany ?? null,
        input.bookingSourceId ?? null,
        input.marketSegmentId ?? null,
        input.channel ?? null,
        input.depositRequired ?? null,
        input.depositAmount ?? null,
        input.attritionClause ?? null,
        input.attritionPercentage ?? null,
        input.guaranteedRooms ?? null,
        input.elasticLimit ?? null,
        input.commissionPercentage ?? null,
        input.isVip ?? null,
        input.priorityLevel ?? null,
        input.notes ?? null,
        input.internalNotes ?? null,
        actorId ?? null,
      ],
    ));
  } catch (error) {
    // `idx_uk_allotments_code`, not a `uq_…` constraint: the uniqueness here is a
    // *partial* unique index (WHERE deleted_at IS NULL), so a retired block's
    // code can be reused. It is invisible to `pg_constraint`, which is how a
    // second, stricter constraint nearly got added beside it.
    if (isUniqueViolationOn(error, "idx_uk_allotments_code")) {
      throw new ReferenceCodeConflictError(
        `Allotment code ${input.allotmentCode} already exists for this property`,
      );
    }
    throw error;
  }

  const allotmentId = rows[0]?.allotment_id;
  if (!allotmentId) return null;

  return getAllotmentById({ allotmentId, tenantId });
};

/**
 * Edit an allotment. `allotment_code`, the dates and the status are not settable
 * here: the code is the contract's reference, moving the window is a new
 * agreement rather than an edit, and the status has its own route so the
 * transition can be checked.
 */
export const updateAllotment = async (
  tenantId: string,
  allotmentId: string,
  input: AllotmentWriteInput,
  actorId?: string,
): Promise<AllotmentListItem | null> => {
  const { rowCount } = await query(
    `
      UPDATE public.allotments
      SET
        allotment_name = COALESCE($3, allotment_name),
        allotment_type = COALESCE($4, allotment_type),
        cutoff_date = COALESCE($5::date, cutoff_date),
        cutoff_days_prior = COALESCE($6, cutoff_days_prior),
        room_type_id = COALESCE($7::uuid, room_type_id),
        total_rooms_blocked = COALESCE($8, total_rooms_blocked),
        rooms_per_night = COALESCE($9, rooms_per_night),
        rooms_picked_up = COALESCE($10, rooms_picked_up),
        rate_type = COALESCE($11, rate_type),
        contracted_rate = COALESCE($12, contracted_rate),
        account_name = COALESCE($13, account_name),
        account_type = COALESCE($14, account_type),
        billing_type = COALESCE($15, billing_type),
        contact_name = COALESCE($16, contact_name),
        contact_email = COALESCE($17, contact_email),
        contact_phone = COALESCE($18, contact_phone),
        contact_company = COALESCE($19, contact_company),
        booking_source_id = COALESCE($20::uuid, booking_source_id),
        market_segment_id = COALESCE($21::uuid, market_segment_id),
        channel = COALESCE($22, channel),
        deposit_required = COALESCE($23, deposit_required),
        deposit_amount = COALESCE($24, deposit_amount),
        attrition_clause = COALESCE($25, attrition_clause),
        attrition_percentage = COALESCE($26, attrition_percentage),
        guaranteed_rooms = COALESCE($27, guaranteed_rooms),
        elastic_limit = COALESCE($28, elastic_limit),
        commission_percentage = COALESCE($29, commission_percentage),
        is_vip = COALESCE($30, is_vip),
        priority_level = COALESCE($31, priority_level),
        notes = COALESCE($32, notes),
        internal_notes = COALESCE($33, internal_notes),
        -- Pickup is a percentage of what is blocked, so it is re-derived rather
        -- than stored twice: raising the block size lowers the percentage, which
        -- is the truthful reading.
        rooms_available = GREATEST(
          COALESCE($8, total_rooms_blocked) - COALESCE($10, rooms_picked_up), 0
        ),
        pickup_percentage = CASE
          WHEN COALESCE($8, total_rooms_blocked) > 0
          THEN ROUND(
            (COALESCE($10, rooms_picked_up)::numeric * 100)
              / COALESCE($8, total_rooms_blocked), 2)
          ELSE 0
        END,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = $34::uuid
      WHERE allotment_id = $1::uuid
        AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      allotmentId,
      tenantId,
      input.allotmentName ?? null,
      input.allotmentType ?? null,
      input.cutoffDate ?? null,
      input.cutoffDaysPrior ?? null,
      input.roomTypeId ?? null,
      input.totalRoomsBlocked ?? null,
      input.roomsPerNight ?? null,
      input.roomsPickedUp ?? null,
      input.rateType ?? null,
      input.contractedRate ?? null,
      input.accountName ?? null,
      input.accountType ?? null,
      input.billingType ?? null,
      input.contactName ?? null,
      input.contactEmail ?? null,
      input.contactPhone ?? null,
      input.contactCompany ?? null,
      input.bookingSourceId ?? null,
      input.marketSegmentId ?? null,
      input.channel ?? null,
      input.depositRequired ?? null,
      input.depositAmount ?? null,
      input.attritionClause ?? null,
      input.attritionPercentage ?? null,
      input.guaranteedRooms ?? null,
      input.elasticLimit ?? null,
      input.commissionPercentage ?? null,
      input.isVip ?? null,
      input.priorityLevel ?? null,
      input.notes ?? null,
      input.internalNotes ?? null,
      actorId ?? null,
    ],
  );

  if (!rowCount) return null;

  return getAllotmentById({ allotmentId, tenantId });
};

/**
 * Move an allotment through its lifecycle.
 *
 * `ALLOTMENT_LEGAL_TRANSITIONS` lives in `@tartware/schemas` so a screen offers
 * only the moves this will accept — the same split as event bookings. Each move
 * stamps its own timestamp, which is what makes "when was this block signed" and
 * "why did it go away" answerable afterwards.
 */
export const transitionAllotmentStatus = async (
  tenantId: string,
  allotmentId: string,
  nextStatus: AllotmentStatus,
  cancellationReason?: string,
  actorId?: string,
): Promise<AllotmentListItem | null> => {
  const { rows } = await query<{ allotment_status: AllotmentStatus }>(
    `SELECT allotment_status FROM public.allotments
      WHERE allotment_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false`,
    [allotmentId, tenantId],
  );

  const current = rows[0]?.allotment_status;
  if (!current) return null;

  if (!ALLOTMENT_LEGAL_TRANSITIONS[current]?.includes(nextStatus)) {
    throw new AllotmentTransitionError(current, nextStatus);
  }

  const { rowCount } = await query(
    `
      UPDATE public.allotments
      SET allotment_status = $3::text,
          confirmed_at = CASE WHEN $3::text = 'DEFINITE' THEN COALESCE(confirmed_at, NOW()) ELSE confirmed_at END,
          confirmed_by = CASE WHEN $3::text = 'DEFINITE' THEN COALESCE(confirmed_by, $5::uuid) ELSE confirmed_by END,
          activated_at = CASE WHEN $3::text = 'ACTIVE' THEN COALESCE(activated_at, NOW()) ELSE activated_at END,
          completed_at = CASE WHEN $3::text = 'COMPLETED' THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
          cancelled_at = CASE WHEN $3::text = 'CANCELLED' THEN COALESCE(cancelled_at, NOW()) ELSE cancelled_at END,
          cancelled_by = CASE WHEN $3::text = 'CANCELLED' THEN COALESCE(cancelled_by, $5::uuid) ELSE cancelled_by END,
          cancellation_reason = CASE WHEN $3::text = 'CANCELLED' THEN COALESCE($4, cancellation_reason) ELSE cancellation_reason END,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $5::uuid
      WHERE allotment_id = $1::uuid
        AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [allotmentId, tenantId, nextStatus, cancellationReason ?? null, actorId ?? null],
  );

  if (!rowCount) return null;

  return getAllotmentById({ allotmentId, tenantId });
};
