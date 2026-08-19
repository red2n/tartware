/**
 * Operations Service
 * Purpose: Service functions for cashier sessions, shift handovers, lost & found,
 *          banquet orders, guest feedback, and police reports
 */

import type {
  BanquetOrderPublishInput,
  BanquetOrderReviseInput,
  BanquetOrderWriteInput,
  BeoStatus,
  PoliceReportStatusInput,
  PoliceReportWriteInput,
  ShiftHandoverWriteInput,
} from "@tartware/schemas";
import {
  type BanquetOrderDetail,
  type BanquetOrderDetailRow,
  BanquetOrderDetailSchema,
  type BanquetOrderListItem,
  BanquetOrderListItemSchema,
  type BanquetOrderRow,
  BEO_EDITABLE_STATUSES,
  BEO_PUBLISHABLE_STATUSES,
  type CashierSessionListItem,
  CashierSessionListItemSchema,
  type CashierSessionRow,
  type GetBanquetOrderInput,
  type GetCashierSessionInput,
  type GetGuestFeedbackInput,
  type GetPoliceReportInput,
  type GetShiftHandoverInput,
  type GuestFeedbackListItem,
  GuestFeedbackListItemSchema,
  type GuestFeedbackRow,
  type GuestFeedbackWriteInput,
  type ListBanquetOrdersInput,
  type ListCashierSessionsInput,
  type ListGuestFeedbackInput,
  type ListPoliceReportsInput,
  type ListShiftHandoversInput,
  type PoliceReportListItem,
  PoliceReportListItemSchema,
  type PoliceReportRow,
  type ShiftHandoverListItem,
  ShiftHandoverListItemSchema,
  type ShiftHandoverRow,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  BANQUET_ORDER_BY_ID_SQL,
  BANQUET_ORDER_LIST_SQL,
  CASHIER_SESSION_BY_ID_SQL,
  CASHIER_SESSION_LIST_SQL,
  GUEST_FEEDBACK_BY_ID_SQL,
  GUEST_FEEDBACK_LIST_SQL,
  POLICE_REPORT_BY_ID_SQL,
  POLICE_REPORT_LIST_SQL,
  SHIFT_HANDOVER_BY_ID_SQL,
  SHIFT_HANDOVER_LIST_SQL,
} from "../sql/operations-queries.js";

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

// =====================================================
// CASHIER SESSIONS
// =====================================================

const mapCashierSessionRow = (row: CashierSessionRow): CashierSessionListItem => {
  return CashierSessionListItemSchema.parse({
    session_id: row.session_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    session_number: row.session_number,
    session_name: row.session_name ?? undefined,
    cashier_id: row.cashier_id,
    cashier_name: row.cashier_name ?? undefined,
    terminal_id: row.terminal_id ?? undefined,
    terminal_name: row.terminal_name ?? undefined,
    location: row.location ?? undefined,
    session_status: row.session_status,
    session_status_display: row.session_status_display,
    opened_at: toIsoString(row.opened_at) ?? "",
    closed_at: toIsoString(row.closed_at) ?? undefined,
    business_date: toIsoString(row.business_date) ?? "",
    shift_type: row.shift_type ?? undefined,
    opening_float_declared: row.opening_float_declared,
    total_transactions: row.total_transactions ?? undefined,
    total_revenue: row.total_revenue ?? undefined,
    total_refunds: row.total_refunds ?? undefined,
    net_revenue: row.net_revenue ?? undefined,
    expected_cash_balance: row.expected_cash_balance ?? undefined,
    closing_cash_counted: row.closing_cash_counted ?? undefined,
    cash_variance: row.cash_variance ?? undefined,
    has_variance: row.has_variance ?? undefined,
    reconciled: row.reconciled ?? undefined,
    approved: row.approved ?? undefined,
    created_at: toIsoString(row.created_at) ?? undefined,
  });
};

export const listCashierSessions = async (
  options: ListCashierSessionsInput,
): Promise<CashierSessionListItem[]> => {
  const { rows } = await query<CashierSessionRow>(CASHIER_SESSION_LIST_SQL, [
    options.limit ?? 50,
    options.tenantId,
    options.propertyId ?? null,
    options.sessionStatus ?? null,
    options.businessDate ?? null,
    options.cashierId ?? null,
    options.offset ?? 0,
  ]);

  return rows.map(mapCashierSessionRow);
};

export const getCashierSessionById = async (
  options: GetCashierSessionInput,
): Promise<CashierSessionListItem | null> => {
  const { rows } = await query<CashierSessionRow>(CASHIER_SESSION_BY_ID_SQL, [
    options.sessionId,
    options.tenantId,
  ]);

  if (rows.length === 0) {
    return null;
  }

  return mapCashierSessionRow(rows[0] as NonNullable<(typeof rows)[0]>);
};

// =====================================================
// SHIFT HANDOVERS
// =====================================================

const mapShiftHandoverRow = (row: ShiftHandoverRow): ShiftHandoverListItem => {
  return ShiftHandoverListItemSchema.parse({
    handover_id: row.handover_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    handover_number: row.handover_number ?? undefined,
    handover_title: row.handover_title ?? undefined,
    shift_date: toIsoString(row.shift_date) ?? "",
    outgoing_shift: row.outgoing_shift,
    outgoing_user_id: row.outgoing_user_id,
    outgoing_user_name: row.outgoing_user_name ?? undefined,
    incoming_shift: row.incoming_shift,
    incoming_user_id: row.incoming_user_id,
    incoming_user_name: row.incoming_user_name ?? undefined,
    department: row.department,
    department_display: row.department_display,
    handover_status: row.handover_status,
    handover_status_display: row.handover_status_display,
    handover_started_at: toIsoString(row.handover_started_at) ?? undefined,
    handover_completed_at: toIsoString(row.handover_completed_at) ?? undefined,
    current_occupancy_percent: row.current_occupancy_percent ?? undefined,
    expected_arrivals_count: row.expected_arrivals_count ?? undefined,
    expected_departures_count: row.expected_departures_count ?? undefined,
    tasks_pending: row.tasks_pending ?? undefined,
    tasks_urgent: row.tasks_urgent ?? undefined,
    key_points: row.key_points,
    requires_follow_up: row.requires_follow_up ?? undefined,
    acknowledged: row.acknowledged ?? undefined,
    created_at: toIsoString(row.created_at) ?? undefined,
  });
};

export const listShiftHandovers = async (
  options: ListShiftHandoversInput,
): Promise<ShiftHandoverListItem[]> => {
  const { rows } = await query<ShiftHandoverRow>(SHIFT_HANDOVER_LIST_SQL, [
    options.limit ?? 50,
    options.tenantId,
    options.propertyId ?? null,
    options.handoverStatus ?? null,
    options.shiftDate ?? null,
    options.department ?? null,
    options.offset ?? 0,
  ]);

  return rows.map(mapShiftHandoverRow);
};

export const getShiftHandoverById = async (
  options: GetShiftHandoverInput,
): Promise<ShiftHandoverListItem | null> => {
  const { rows } = await query<ShiftHandoverRow>(SHIFT_HANDOVER_BY_ID_SQL, [
    options.handoverId,
    options.tenantId,
  ]);

  if (rows.length === 0) {
    return null;
  }

  return mapShiftHandoverRow(rows[0] as NonNullable<(typeof rows)[0]>);
};

// =====================================================
// SHIFT HANDOVERS — WRITE PATH
//
// Read-only until 2026-08-13, so the operational handover happened verbally or
// in a notebook and open items were dropped at every shift change. Per
// ui-gaps/18-write-path-gap.md this is one service, one table, no fan-out — so
// plain HTTP. See ui-gaps/08-shift-handovers.md.
// =====================================================

/** `SH-YYYYMMDD-XXXX`, matching the police-report and folio numbering style. */
const buildHandoverNumber = (): string => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SH-${datePart}-${random}`;
};

/**
 * Open a handover for a shift.
 *
 * Starts `in_progress` with `handover_started_at` stamped: the record is opened
 * at the start of the outgoing shift and filled as it runs, rather than written
 * in one go at the end when the details have already been forgotten.
 */
export const createShiftHandover = async (
  tenantId: string,
  input: ShiftHandoverWriteInput,
  actorId?: string,
): Promise<ShiftHandoverListItem | null> => {
  const { rows } = await query<{ handover_id: string }>(
    `
      INSERT INTO public.shift_handovers (
        tenant_id, property_id, handover_number, handover_title,
        shift_date, department,
        outgoing_shift, outgoing_user_id, outgoing_user_name,
        incoming_shift, incoming_user_id, incoming_user_name,
        key_points, important_notes, urgent_matters,
        handover_status, handover_started_at,
        requires_follow_up,
        cash_on_hand, deposits_to_make, payment_issues,
        staff_issues, special_situations,
        created_by, updated_by
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4,
        $5::date, $6,
        $7, $8::uuid, $9,
        $10, $11::uuid, $12,
        $13, $14, $15,
        'in_progress', CURRENT_TIMESTAMP,
        COALESCE($16, false),
        $17, $18, $19,
        $20, $21,
        $22, $22
      )
      RETURNING handover_id
    `,
    [
      tenantId,
      input.propertyId,
      buildHandoverNumber(),
      input.handoverTitle ?? null,
      input.shiftDate,
      input.department,
      input.outgoingShift,
      input.outgoingUserId,
      input.outgoingUserName ?? null,
      input.incomingShift,
      input.incomingUserId,
      input.incomingUserName ?? null,
      input.keyPoints,
      input.importantNotes ?? null,
      input.urgentMatters ?? null,
      input.requiresFollowUp ?? null,
      input.cashOnHand ?? null,
      input.depositsToMake ?? null,
      input.paymentIssues ?? null,
      input.staffIssues ?? null,
      input.specialSituations ?? null,
      actorId ?? null,
    ],
  );

  const handoverId = rows[0]?.handover_id;
  if (!handoverId) return null;

  return getShiftHandoverById({ handoverId, tenantId });
};

/**
 * Add or edit notes and open items while the shift runs.
 *
 * `COALESCE` keeps the stored value when a field is absent. Shift, department
 * and the two users are deliberately not settable — changing who a handover is
 * between makes it a different record, not an edit of this one.
 */
export const updateShiftHandover = async (
  tenantId: string,
  handoverId: string,
  input: Partial<ShiftHandoverWriteInput>,
  actorId?: string,
): Promise<ShiftHandoverListItem | null> => {
  const { rowCount } = await query(
    `
      UPDATE public.shift_handovers
      SET
        handover_title = COALESCE($3, handover_title),
        key_points = COALESCE($4, key_points),
        important_notes = COALESCE($5, important_notes),
        urgent_matters = COALESCE($6, urgent_matters),
        handover_status = COALESCE($7, handover_status),
        requires_follow_up = COALESCE($8, requires_follow_up),
        cash_on_hand = COALESCE($9, cash_on_hand),
        deposits_to_make = COALESCE($10, deposits_to_make),
        payment_issues = COALESCE($11, payment_issues),
        staff_issues = COALESCE($12, staff_issues),
        special_situations = COALESCE($13, special_situations),
        handover_completed_at = CASE
          WHEN $7 = 'completed' AND handover_completed_at IS NULL
          THEN CURRENT_TIMESTAMP ELSE handover_completed_at
        END,
        updated_by = $14,
        updated_at = CURRENT_TIMESTAMP
      WHERE handover_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      handoverId,
      tenantId,
      input.handoverTitle ?? null,
      input.keyPoints ?? null,
      input.importantNotes ?? null,
      input.urgentMatters ?? null,
      input.handoverStatus ?? null,
      input.requiresFollowUp ?? null,
      input.cashOnHand ?? null,
      input.depositsToMake ?? null,
      input.paymentIssues ?? null,
      input.staffIssues ?? null,
      input.specialSituations ?? null,
      actorId ?? null,
    ],
  );

  if (!rowCount) return null;

  return getShiftHandoverById({ handoverId, tenantId });
};

/**
 * The incoming staff member signs off.
 *
 * Guarded on `acknowledged = false` so a second call cannot overwrite who
 * actually took the handover, or when — that pair is the whole evidentiary value
 * of the record.
 */
export const acknowledgeShiftHandover = async (
  tenantId: string,
  handoverId: string,
  input: {
    acknowledgmentNotes?: string;
    questionsAsked?: string;
    handoverQualityRating?: number;
  },
  actorId?: string,
): Promise<ShiftHandoverListItem | null> => {
  const { rowCount } = await query(
    `
      UPDATE public.shift_handovers
      SET
        acknowledged = true,
        acknowledged_by = $3::uuid,
        acknowledged_at = CURRENT_TIMESTAMP,
        acknowledgment_notes = $4,
        questions_asked = COALESCE($5, questions_asked),
        handover_quality_rating = COALESCE($6, handover_quality_rating),
        handover_status = 'acknowledged',
        handover_completed_at = COALESCE(handover_completed_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      WHERE handover_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(acknowledged, false) = false
        AND COALESCE(is_deleted, false) = false
    `,
    [
      handoverId,
      tenantId,
      actorId ?? null,
      input.acknowledgmentNotes ?? null,
      input.questionsAsked ?? null,
      input.handoverQualityRating ?? null,
    ],
  );

  if (!rowCount) return null;

  return getShiftHandoverById({ handoverId, tenantId });
};

// =====================================================
// BANQUET EVENT ORDERS
// =====================================================

const mapBanquetOrderRow = (row: BanquetOrderRow): BanquetOrderListItem => {
  return BanquetOrderListItemSchema.parse({
    beo_id: row.beo_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    event_booking_id: row.event_booking_id,
    beo_number: row.beo_number,
    beo_version: row.beo_version ?? undefined,
    beo_status: row.beo_status,
    beo_status_display: row.beo_status_display,
    event_date: toIsoString(row.event_date) ?? "",
    event_start_time: row.event_start_time,
    event_end_time: row.event_end_time,
    meeting_room_id: row.meeting_room_id,
    meeting_room_name: row.meeting_room_name ?? undefined,
    room_setup: row.room_setup,
    room_setup_display: row.room_setup_display,
    guaranteed_count: row.guaranteed_count,
    expected_count: row.expected_count ?? undefined,
    actual_count: row.actual_count ?? undefined,
    menu_type: row.menu_type ?? undefined,
    service_style: row.service_style ?? undefined,
    bar_type: row.bar_type ?? undefined,
    food_subtotal: row.food_subtotal ?? undefined,
    beverage_subtotal: row.beverage_subtotal ?? undefined,
    total_estimated: row.total_estimated ?? undefined,
    total_actual: row.total_actual ?? undefined,
    client_approved: row.client_approved ?? undefined,
    chef_approved: row.chef_approved ?? undefined,
    manager_approved: row.manager_approved ?? undefined,
    setup_completed: row.setup_completed ?? undefined,
    event_started: row.event_started ?? undefined,
    event_ended: row.event_ended ?? undefined,
    created_at: toIsoString(row.created_at) ?? "",
    is_superseded: row.is_superseded,
  });
};

/**
 * The whole BEO document, for the by-id read and every write response.
 *
 * Built on the list item's mapping so the two can never disagree about a shared
 * field — the drift that made `EventBookingListItem` and its detail diverge in
 * slice 2.
 */
const mapBanquetOrderDetailRow = (row: BanquetOrderDetailRow): BanquetOrderDetail => {
  return BanquetOrderDetailSchema.parse({
    ...mapBanquetOrderRow(row),

    revision_date: toIsoString(row.revision_date),
    revision_reason: row.revision_reason ?? undefined,
    previous_beo_id: row.previous_beo_id ?? undefined,

    setup_start_time: row.setup_start_time,
    teardown_end_time: row.teardown_end_time ?? undefined,
    room_release_time: row.room_release_time ?? undefined,

    tables_count: row.tables_count ?? undefined,
    chairs_count: row.chairs_count ?? undefined,
    table_configuration: row.table_configuration ?? undefined,
    seating_chart_layout_url: row.seating_chart_layout_url ?? undefined,
    over_set_percentage: row.over_set_percentage ?? undefined,

    menu_items: row.menu_items ?? undefined,
    courses_count: row.courses_count ?? undefined,
    meal_service_start_time: row.meal_service_start_time ?? undefined,
    meal_service_duration_minutes: row.meal_service_duration_minutes ?? undefined,
    appetizers: row.appetizers ?? undefined,
    salads: row.salads ?? undefined,
    entrees: row.entrees ?? undefined,
    sides: row.sides ?? undefined,
    desserts: row.desserts ?? undefined,
    stations: row.stations ?? undefined,

    bar_start_time: row.bar_start_time ?? undefined,
    bar_end_time: row.bar_end_time ?? undefined,
    bar_setup_location: row.bar_setup_location ?? undefined,
    beverages: row.beverages ?? undefined,
    wine_service: row.wine_service ?? undefined,
    coffee_tea_service: row.coffee_tea_service ?? undefined,
    water_service: row.water_service ?? undefined,

    vegetarian_count: row.vegetarian_count ?? undefined,
    vegan_count: row.vegan_count ?? undefined,
    gluten_free_count: row.gluten_free_count ?? undefined,
    dairy_free_count: row.dairy_free_count ?? undefined,
    nut_free_count: row.nut_free_count ?? undefined,
    kosher_count: row.kosher_count ?? undefined,
    halal_count: row.halal_count ?? undefined,
    special_diets: row.special_diets ?? undefined,

    linen_color: row.linen_color ?? undefined,
    linen_type: row.linen_type ?? undefined,
    napkin_color: row.napkin_color ?? undefined,
    napkin_fold: row.napkin_fold ?? undefined,
    table_skirting: row.table_skirting ?? undefined,
    centerpieces: row.centerpieces ?? undefined,
    decor_description: row.decor_description ?? undefined,
    candles: row.candles ?? undefined,
    floral_arrangements: row.floral_arrangements ?? undefined,

    equipment_list: row.equipment_list ?? undefined,
    av_equipment: row.av_equipment ?? undefined,
    stage_required: row.stage_required ?? undefined,
    stage_dimensions: row.stage_dimensions ?? undefined,
    podium_required: row.podium_required ?? undefined,
    dance_floor_required: row.dance_floor_required ?? undefined,
    special_lighting: row.special_lighting ?? undefined,
    lighting_notes: row.lighting_notes ?? undefined,

    servers_count: row.servers_count ?? undefined,
    bartenders_count: row.bartenders_count ?? undefined,
    chefs_count: row.chefs_count ?? undefined,
    captains_count: row.captains_count ?? undefined,
    coat_check_attendants: row.coat_check_attendants ?? undefined,
    valet_attendants: row.valet_attendants ?? undefined,
    security_guards: row.security_guards ?? undefined,
    staff_arrival_time: row.staff_arrival_time ?? undefined,
    staff_meal_time: row.staff_meal_time ?? undefined,
    staff_break_schedule: row.staff_break_schedule ?? undefined,
    overtime_authorized: row.overtime_authorized ?? undefined,

    equipment_rental_total: row.equipment_rental_total ?? undefined,
    labor_charges: row.labor_charges ?? undefined,
    service_charge_percent: row.service_charge_percent ?? undefined,
    service_charge_amount: row.service_charge_amount ?? undefined,
    gratuity_percent: row.gratuity_percent ?? undefined,
    gratuity_amount: row.gratuity_amount ?? undefined,
    tax_percent: row.tax_percent ?? undefined,
    tax_amount: row.tax_amount ?? undefined,
    currency_code: row.currency_code ?? undefined,
    billing_type: row.billing_type ?? undefined,
    price_per_person: row.price_per_person ?? undefined,
    children_price: row.children_price ?? undefined,
    children_count: row.children_count ?? undefined,

    kitchen_instructions: row.kitchen_instructions ?? undefined,
    service_instructions: row.service_instructions ?? undefined,
    setup_instructions: row.setup_instructions ?? undefined,
    cleanup_instructions: row.cleanup_instructions ?? undefined,
    audio_visual_instructions: row.audio_visual_instructions ?? undefined,

    client_approved_date: toIsoString(row.client_approved_date),
    client_approved_by: row.client_approved_by ?? undefined,
    client_signature_url: row.client_signature_url ?? undefined,
    chef_approved_date: toIsoString(row.chef_approved_date),
    chef_approved_by: row.chef_approved_by ?? undefined,
    manager_approved_date: toIsoString(row.manager_approved_date),
    manager_approved_by: row.manager_approved_by ?? undefined,

    setup_completed_time: toIsoString(row.setup_completed_time),
    event_started_time: toIsoString(row.event_started_time),
    event_ended_time: toIsoString(row.event_ended_time),
    teardown_completed: row.teardown_completed ?? undefined,
    teardown_completed_time: toIsoString(row.teardown_completed_time),

    post_event_notes: row.post_event_notes ?? undefined,
    issues_encountered: row.issues_encountered ?? undefined,
    client_satisfaction_rating: row.client_satisfaction_rating ?? undefined,
    photos: row.photos ?? undefined,

    last_sent_to_client: toIsoString(row.last_sent_to_client),
    last_sent_to_kitchen: toIsoString(row.last_sent_to_kitchen),
    last_sent_to_setup: toIsoString(row.last_sent_to_setup),
    distribution_list: row.distribution_list ?? undefined,

    signed_beo_url: row.signed_beo_url ?? undefined,
    floor_plan_url: row.floor_plan_url ?? undefined,
    seating_chart_document_url: row.seating_chart_document_url ?? undefined,
    menu_card_url: row.menu_card_url ?? undefined,

    internal_notes: row.internal_notes ?? undefined,
    client_notes: row.client_notes ?? undefined,
    allergy_warnings: row.allergy_warnings ?? undefined,

    metadata: row.metadata ?? undefined,
    updated_at: toIsoString(row.updated_at),
  });
};

export const listBanquetOrders = async (
  options: ListBanquetOrdersInput,
): Promise<BanquetOrderListItem[]> => {
  const { rows } = await query<BanquetOrderRow>(BANQUET_ORDER_LIST_SQL, [
    options.limit ?? 50,
    options.tenantId,
    options.propertyId ?? null,
    options.beoStatus ?? null,
    options.eventDate ?? null,
    options.meetingRoomId ?? null,
    options.offset ?? 0,
  ]);

  return rows.map(mapBanquetOrderRow);
};

export const getBanquetOrderById = async (
  options: GetBanquetOrderInput,
): Promise<BanquetOrderDetail | null> => {
  const { rows } = await query<BanquetOrderDetailRow>(BANQUET_ORDER_BY_ID_SQL, [
    options.beoId,
    options.tenantId,
  ]);

  if (rows.length === 0) {
    return null;
  }

  return mapBanquetOrderDetailRow(rows[0] as NonNullable<(typeof rows)[0]>);
};

// =====================================================
// BANQUET EVENT ORDER WRITES
// Slice 3 of ui-gaps/13-sales-catering.md. Plain HTTP on the owning service per
// COV-18's rule, matching slices 1 and 2.
// =====================================================

/** Raised when the linked event booking or meeting room does not exist. */
export class BanquetOrderReferenceError extends Error {
  constructor(what: string, id: string) {
    super(`${what} ${id} not found`);
    this.name = "BanquetOrderReferenceError";
  }
}

/** Raised when (tenant, property, beo_number, beo_version) collides. */
export class BanquetOrderNumberConflictError extends Error {
  constructor(beoNumber: string, version: number) {
    super(`BEO ${beoNumber} version ${version} already exists`);
    this.name = "BanquetOrderNumberConflictError";
  }
}

/** Raised when an in-place edit is attempted on a published BEO. */
export class BanquetOrderFrozenError extends Error {
  constructor(beoStatus: string) {
    super(`A ${beoStatus} BEO cannot be edited in place — revise it to produce a new version`);
    this.name = "BanquetOrderFrozenError";
  }
}

/** Raised when publish or revise is not legal from the current state. */
export class BanquetOrderTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BanquetOrderTransitionError";
  }
}

const UNIQUE_VIOLATION = "23505";

const isBeoNumberConflict = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: string }).code === UNIQUE_VIOLATION;

/**
 * `BEO-YYYYMMDD-XXXX`, matching the police report number style.
 *
 * The number identifies the *document*, not the row: every revision of a BEO
 * keeps it and increments `beo_version` instead, which is what the table's
 * `UNIQUE (tenant_id, property_id, beo_number, beo_version)` is for.
 */
const buildBeoNumber = (): string => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BEO-${datePart}-${random}`;
};

/**
 * Column/value pairs for a dynamically built statement.
 *
 * A BEO has ~140 writable columns. Written as a positional `INSERT` the way the
 * smaller domains in this file are, a single misalignment between the column
 * list and the parameter list would write the right value into the wrong column
 * and still typecheck — the exact failure mode slice 2 hit in SQL that the type
 * checker could not see. Naming each column beside its value removes the class
 * of bug entirely.
 */
type BeoColumnValues = Record<string, unknown>;

/**
 * `JSONB` columns must be handed to `pg` as text.
 *
 * node-postgres turns a JS array into a Postgres *array literal* (`{a,b}`), so
 * passing `menu_items` as an array would try to store an array literal in a
 * JSONB column rather than a JSON document. `distribution_list` is the one field
 * here that really is a Postgres `TEXT[]` and must NOT be stringified.
 */
const toJsonbParam = (value: unknown): string | null =>
  value === undefined || value === null ? null : JSON.stringify(value);

/**
 * Maps the service input onto table columns.
 *
 * Every key here was checked against `scripts/tables/02-inventory/99_banquet_event_orders.sql`.
 * Keys whose value is `undefined` are dropped by the statement builders, so a
 * partial update touches only what the caller actually sent.
 */
const toBeoColumnValues = (input: BanquetOrderWriteInput): BeoColumnValues => ({
  event_booking_id: input.eventBookingId,
  event_date: input.eventDate,
  setup_start_time: input.setupStartTime,
  event_start_time: input.eventStartTime,
  event_end_time: input.eventEndTime,
  teardown_end_time: input.teardownEndTime,
  room_release_time: input.roomReleaseTime,
  meeting_room_id: input.meetingRoomId,
  room_setup: input.roomSetup,
  tables_count: input.tablesCount,
  chairs_count: input.chairsCount,
  table_configuration: input.tableConfiguration,
  seating_chart_layout_url: input.seatingChartLayoutUrl,
  guaranteed_count: input.guaranteedCount,
  expected_count: input.expectedCount,
  over_set_percentage: input.overSetPercentage,
  actual_count: input.actualCount,
  menu_type: input.menuType,
  menu_items: input.menuItems === undefined ? undefined : toJsonbParam(input.menuItems),
  service_style: input.serviceStyle,
  courses_count: input.coursesCount,
  meal_service_start_time: input.mealServiceStartTime,
  meal_service_duration_minutes: input.mealServiceDurationMinutes,
  appetizers: input.appetizers === undefined ? undefined : toJsonbParam(input.appetizers),
  salads: input.salads === undefined ? undefined : toJsonbParam(input.salads),
  entrees: input.entrees === undefined ? undefined : toJsonbParam(input.entrees),
  sides: input.sides === undefined ? undefined : toJsonbParam(input.sides),
  desserts: input.desserts === undefined ? undefined : toJsonbParam(input.desserts),
  stations: input.stations === undefined ? undefined : toJsonbParam(input.stations),
  bar_type: input.barType,
  bar_start_time: input.barStartTime,
  bar_end_time: input.barEndTime,
  bar_setup_location: input.barSetupLocation,
  beverages: input.beverages === undefined ? undefined : toJsonbParam(input.beverages),
  wine_service: input.wineService === undefined ? undefined : toJsonbParam(input.wineService),
  coffee_tea_service: input.coffeeTeaService,
  water_service: input.waterService,
  vegetarian_count: input.vegetarianCount,
  vegan_count: input.veganCount,
  gluten_free_count: input.glutenFreeCount,
  dairy_free_count: input.dairyFreeCount,
  nut_free_count: input.nutFreeCount,
  kosher_count: input.kosherCount,
  halal_count: input.halalCount,
  special_diets: input.specialDiets === undefined ? undefined : toJsonbParam(input.specialDiets),
  linen_color: input.linenColor,
  linen_type: input.linenType,
  napkin_color: input.napkinColor,
  napkin_fold: input.napkinFold,
  table_skirting: input.tableSkirting,
  centerpieces: input.centerpieces,
  decor_description: input.decorDescription,
  candles: input.candles,
  floral_arrangements: input.floralArrangements,
  equipment_list: input.equipmentList === undefined ? undefined : toJsonbParam(input.equipmentList),
  av_equipment: input.avEquipment === undefined ? undefined : toJsonbParam(input.avEquipment),
  stage_required: input.stageRequired,
  stage_dimensions: input.stageDimensions,
  podium_required: input.podiumRequired,
  dance_floor_required: input.danceFloorRequired,
  special_lighting: input.specialLighting,
  lighting_notes: input.lightingNotes,
  servers_count: input.serversCount,
  bartenders_count: input.bartendersCount,
  chefs_count: input.chefsCount,
  captains_count: input.captainsCount,
  coat_check_attendants: input.coatCheckAttendants,
  valet_attendants: input.valetAttendants,
  security_guards: input.securityGuards,
  staff_arrival_time: input.staffArrivalTime,
  staff_meal_time: input.staffMealTime,
  staff_break_schedule: input.staffBreakSchedule,
  overtime_authorized: input.overtimeAuthorized,
  food_subtotal: input.foodSubtotal,
  beverage_subtotal: input.beverageSubtotal,
  equipment_rental_total: input.equipmentRentalTotal,
  labor_charges: input.laborCharges,
  service_charge_percent: input.serviceChargePercent,
  service_charge_amount: input.serviceChargeAmount,
  gratuity_percent: input.gratuityPercent,
  gratuity_amount: input.gratuityAmount,
  tax_percent: input.taxPercent,
  tax_amount: input.taxAmount,
  total_estimated: input.totalEstimated,
  total_actual: input.totalActual,
  currency_code: input.currencyCode,
  billing_type: input.billingType,
  price_per_person: input.pricePerPerson,
  children_price: input.childrenPrice,
  children_count: input.childrenCount,
  kitchen_instructions: input.kitchenInstructions,
  service_instructions: input.serviceInstructions,
  setup_instructions: input.setupInstructions,
  cleanup_instructions: input.cleanupInstructions,
  audio_visual_instructions: input.audioVisualInstructions,
  client_approved: input.clientApproved,
  client_approved_by: input.clientApprovedBy,
  client_signature_url: input.clientSignatureUrl,
  chef_approved: input.chefApproved,
  chef_approved_by: input.chefApprovedBy,
  manager_approved: input.managerApproved,
  manager_approved_by: input.managerApprovedBy,
  setup_completed: input.setupCompleted,
  event_started: input.eventStarted,
  event_ended: input.eventEnded,
  teardown_completed: input.teardownCompleted,
  post_event_notes: input.postEventNotes,
  issues_encountered: input.issuesEncountered,
  client_satisfaction_rating: input.clientSatisfactionRating,
  photos: input.photos === undefined ? undefined : toJsonbParam(input.photos),
  // TEXT[], not JSONB — pg's own array encoding is correct here.
  distribution_list: input.distributionList,
  signed_beo_url: input.signedBeoUrl,
  floor_plan_url: input.floorPlanUrl,
  seating_chart_document_url: input.seatingChartDocumentUrl,
  menu_card_url: input.menuCardUrl,
  internal_notes: input.internalNotes,
  client_notes: input.clientNotes,
  allergy_warnings: input.allergyWarnings,
  metadata: input.metadata === undefined ? undefined : toJsonbParam(input.metadata),
});

/** Drops the keys the caller did not send. */
const definedColumns = (columns: BeoColumnValues): [string, unknown][] =>
  Object.entries(columns).filter(([, value]) => value !== undefined);

/**
 * The approval stamps that a `true` boolean should carry with it.
 *
 * Setting `chef_approved` without `chef_approved_date` would leave the BEO
 * claiming an approval with no time on it, which is the field the kitchen reads
 * to know whether the approval predates the last revision.
 */
const APPROVAL_STAMPS: Record<string, string> = {
  client_approved: "client_approved_date",
  chef_approved: "chef_approved_date",
  manager_approved: "manager_approved_date",
};

/** Confirms the linked event booking and meeting room exist for this tenant. */
const assertBeoReferences = async (
  tenantId: string,
  eventBookingId: string | undefined,
  meetingRoomId: string | undefined,
): Promise<void> => {
  if (eventBookingId) {
    const { rows } = await query<{ event_id: string }>(
      `
        SELECT event_id FROM public.event_bookings
        WHERE event_id = $1::uuid AND tenant_id = $2::uuid
          AND COALESCE(is_deleted, false) = false
        LIMIT 1
      `,
      [eventBookingId, tenantId],
    );
    if (rows.length === 0) {
      throw new BanquetOrderReferenceError("Event booking", eventBookingId);
    }
  }

  if (meetingRoomId) {
    const { rows } = await query<{ room_id: string }>(
      `
        SELECT room_id FROM public.meeting_rooms
        WHERE room_id = $1::uuid AND tenant_id = $2::uuid
          AND COALESCE(is_deleted, false) = false
        LIMIT 1
      `,
      [meetingRoomId, tenantId],
    );
    if (rows.length === 0) {
      throw new BanquetOrderReferenceError("Meeting room", meetingRoomId);
    }
  }
};

/** The current state of one BEO, for the guards that run before a write. */
const getBeoState = async (
  tenantId: string,
  beoId: string,
): Promise<{
  beoStatus: BeoStatus;
  beoNumber: string;
  beoVersion: number;
  isSuperseded: boolean;
} | null> => {
  const { rows } = await query<{
    beo_status: BeoStatus;
    beo_number: string;
    beo_version: number | null;
    is_superseded: boolean;
  }>(
    `
      SELECT beo.beo_status, beo.beo_number, beo.beo_version,
             EXISTS (
               SELECT 1 FROM public.banquet_event_orders newer
               WHERE newer.previous_beo_id = beo.beo_id
                 AND COALESCE(newer.is_deleted, false) = false
             ) AS is_superseded
      FROM public.banquet_event_orders beo
      WHERE beo.beo_id = $1::uuid AND beo.tenant_id = $2::uuid
        AND COALESCE(beo.is_deleted, false) = false
      LIMIT 1
    `,
    [beoId, tenantId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    beoStatus: row.beo_status,
    beoNumber: row.beo_number,
    beoVersion: row.beo_version ?? 1,
    isSuperseded: row.is_superseded,
  };
};

/**
 * Create a banquet event order.
 *
 * The BEO is born a DRAFT: `beo_status` is not settable from the payload, so the
 * only ways out of draft are {@link publishBanquetOrder} and
 * {@link reviseBanquetOrder}. That is what makes "frozen for the kitchen" a
 * property of the data rather than a convention.
 */
export const createBanquetOrder = async (
  tenantId: string,
  propertyId: string,
  input: BanquetOrderWriteInput,
  actorId?: string,
): Promise<BanquetOrderDetail | null> => {
  await assertBeoReferences(tenantId, input.eventBookingId, input.meetingRoomId);

  const beoNumber = input.beoNumber ?? buildBeoNumber();
  const columns: BeoColumnValues = {
    tenant_id: tenantId,
    property_id: propertyId,
    beo_number: beoNumber,
    beo_version: 1,
    beo_status: "DRAFT",
    ...toBeoColumnValues(input),
    created_by: actorId ?? null,
    updated_by: actorId ?? null,
  };

  // An approval sent on create still needs its timestamp.
  for (const [flag, stamp] of Object.entries(APPROVAL_STAMPS)) {
    if (columns[flag] === true) {
      columns[stamp] = new Date();
    }
  }

  const entries = definedColumns(columns);
  const names = entries.map(([name]) => name);
  const values = entries.map(([, value]) => value);
  const placeholders = names.map((_, index) => `$${index + 1}`);

  let beoId: string | undefined;
  try {
    const { rows } = await query<{ beo_id: string }>(
      `
        INSERT INTO public.banquet_event_orders (${names.join(", ")})
        VALUES (${placeholders.join(", ")})
        RETURNING beo_id
      `,
      values,
    );
    beoId = rows[0]?.beo_id;
  } catch (error) {
    if (isBeoNumberConflict(error)) {
      throw new BanquetOrderNumberConflictError(beoNumber, 1);
    }
    throw error;
  }

  if (!beoId) return null;

  return getBanquetOrderById({ beoId, tenantId });
};

/**
 * Edit a BEO in place.
 *
 * Refused once the BEO has been published: the kitchen and the setup crew are
 * working from a copy, and an in-place edit would leave them holding a document
 * that silently no longer matches the system. Publishing is the point at which
 * that stops being allowed, and {@link reviseBanquetOrder} is the way through.
 */
export const updateBanquetOrder = async (
  tenantId: string,
  beoId: string,
  input: BanquetOrderWriteInput,
  actorId?: string,
): Promise<BanquetOrderDetail | null> => {
  const state = await getBeoState(tenantId, beoId);
  if (!state) return null;

  if (!BEO_EDITABLE_STATUSES.includes(state.beoStatus)) {
    throw new BanquetOrderFrozenError(state.beoStatus);
  }

  await assertBeoReferences(tenantId, undefined, input.meetingRoomId);

  const columns = toBeoColumnValues(input);
  for (const [flag, stamp] of Object.entries(APPROVAL_STAMPS)) {
    if (columns[flag] === true) {
      columns[stamp] = new Date();
    }
  }

  const entries = definedColumns(columns);
  if (entries.length === 0) {
    // Nothing to change — report the BEO as it stands rather than touching
    // updated_at for a no-op.
    return getBanquetOrderById({ beoId, tenantId });
  }

  const values = entries.map(([, value]) => value);
  // $1 and $2 are the identity predicate; assignments start at $3.
  const assignments = entries.map(([name], index) => `${name} = $${index + 3}`);

  const { rowCount } = await query(
    `
      UPDATE public.banquet_event_orders
      SET ${assignments.join(", ")},
          updated_at = NOW(),
          updated_by = $${entries.length + 3}
      WHERE tenant_id = $1::uuid
        AND beo_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [tenantId, beoId, ...values, actorId ?? null],
  );

  if (!rowCount) return null;

  return getBanquetOrderById({ beoId, tenantId });
};

/**
 * Publish a BEO — freeze it and stamp the distribution.
 *
 * Publishing an already-published BEO is a 409 rather than a silent no-op: the
 * caller believes it is releasing something the departments have not seen, and
 * it is not. Re-issuing a published BEO means revising it.
 */
export const publishBanquetOrder = async (
  tenantId: string,
  beoId: string,
  input: BanquetOrderPublishInput,
  actorId?: string,
): Promise<BanquetOrderDetail | null> => {
  const state = await getBeoState(tenantId, beoId);
  if (!state) return null;

  if (!BEO_PUBLISHABLE_STATUSES.includes(state.beoStatus)) {
    throw new BanquetOrderTransitionError(
      `A ${state.beoStatus} BEO cannot be published — revise it to issue a new version`,
    );
  }

  if (state.isSuperseded) {
    throw new BanquetOrderTransitionError(
      `BEO ${state.beoNumber} version ${state.beoVersion} has already been revised — publish the current version instead`,
    );
  }

  const { rowCount } = await query(
    `
      UPDATE public.banquet_event_orders
      SET
        beo_status = 'APPROVED',
        distribution_list = COALESCE($3::text[], distribution_list),
        last_sent_to_kitchen = NOW(),
        last_sent_to_setup = NOW(),
        last_sent_to_client = CASE WHEN $4::boolean THEN NOW() ELSE last_sent_to_client END,
        updated_at = NOW(),
        updated_by = $5
      WHERE tenant_id = $1::uuid
        AND beo_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [tenantId, beoId, input.distributionList ?? null, input.notifyClient ?? false, actorId ?? null],
  );

  if (!rowCount) return null;

  return getBanquetOrderById({ beoId, tenantId });
};

/**
 * Revise a BEO — the versioning the document type exists for.
 *
 * The revision is a new row rather than an edit, so the version the kitchen was
 * given stays readable exactly as it was issued. It copies the source row whole
 * via `to_jsonb` / `jsonb_populate_record` rather than naming ~140 columns:
 * a column added to the table later is carried into revisions automatically,
 * where a hand-written column list would quietly start dropping it.
 *
 * What deliberately does *not* carry over:
 * - **approvals** — the chef approved a different menu, so v2 starts unapproved;
 * - **`last_sent_to_*`** — nobody has been sent this version yet;
 * - **audit and lock fields** — the new row is new.
 *
 * Execution tracking (`setup_completed`, `event_started`, …) *does* carry over:
 * those describe the physical event, which a paperwork revision does not undo.
 */
export const reviseBanquetOrder = async (
  tenantId: string,
  beoId: string,
  input: BanquetOrderReviseInput,
  actorId?: string,
): Promise<BanquetOrderDetail | null> => {
  const state = await getBeoState(tenantId, beoId);
  if (!state) return null;

  if (state.beoStatus === "CANCELLED") {
    throw new BanquetOrderTransitionError("A cancelled BEO cannot be revised");
  }

  if (state.isSuperseded) {
    throw new BanquetOrderTransitionError(
      `BEO ${state.beoNumber} version ${state.beoVersion} has already been revised — revise the current version instead`,
    );
  }

  let revisionId: string | undefined;
  try {
    const { rows } = await query<{ beo_id: string }>(
      `
        WITH source AS (
          SELECT * FROM public.banquet_event_orders
          WHERE beo_id = $1::uuid AND tenant_id = $2::uuid
            AND COALESCE(is_deleted, false) = false
        )
        INSERT INTO public.banquet_event_orders
        SELECT (jsonb_populate_record(
          NULL::public.banquet_event_orders,
          to_jsonb(source) || jsonb_build_object(
            'beo_id', uuid_generate_v4(),
            'beo_version', COALESCE(source.beo_version, 1) + 1,
            'beo_status', 'DRAFT',
            'previous_beo_id', source.beo_id,
            'revision_date', NOW(),
            'revision_reason', $3::text,
            'client_approved', false,
            'client_approved_date', NULL,
            'client_approved_by', NULL,
            'client_signature_url', NULL,
            'chef_approved', false,
            'chef_approved_date', NULL,
            'chef_approved_by', NULL,
            'manager_approved', false,
            'manager_approved_date', NULL,
            'manager_approved_by', NULL,
            'last_sent_to_client', NULL,
            'last_sent_to_kitchen', NULL,
            'last_sent_to_setup', NULL,
            'signed_beo_url', NULL,
            'created_at', NOW(),
            'updated_at', NULL,
            'created_by', $4::uuid,
            'updated_by', $4::uuid,
            'is_deleted', false,
            'deleted_at', NULL,
            'deleted_by', NULL,
            'version', 0
          )
        )).*
        FROM source
        RETURNING beo_id
      `,
      [beoId, tenantId, input.revisionReason, actorId ?? null],
    );
    revisionId = rows[0]?.beo_id;
  } catch (error) {
    if (isBeoNumberConflict(error)) {
      throw new BanquetOrderNumberConflictError(state.beoNumber, state.beoVersion + 1);
    }
    throw error;
  }

  if (!revisionId) return null;

  return getBanquetOrderById({ beoId: revisionId, tenantId });
};

// =====================================================
// GUEST FEEDBACK
// =====================================================

const mapGuestFeedbackRow = (row: GuestFeedbackRow): GuestFeedbackListItem => {
  return GuestFeedbackListItemSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    guest_id: row.guest_id ?? undefined,
    guest_name: row.guest_name ?? undefined,
    reservation_id: row.reservation_id ?? undefined,
    feedback_source: row.feedback_source ?? undefined,
    feedback_source_display: row.feedback_source_display ?? undefined,
    overall_rating: row.overall_rating ?? undefined,
    rating_scale: row.rating_scale ?? undefined,
    cleanliness_rating: row.cleanliness_rating ?? undefined,
    staff_rating: row.staff_rating ?? undefined,
    location_rating: row.location_rating ?? undefined,
    value_rating: row.value_rating ?? undefined,
    review_title: row.review_title ?? undefined,
    review_text: row.review_text ?? undefined,
    would_recommend: row.would_recommend ?? undefined,
    would_return: row.would_return ?? undefined,
    sentiment_label: row.sentiment_label ?? undefined,
    is_verified: row.is_verified ?? undefined,
    is_public: row.is_public ?? undefined,
    is_featured: row.is_featured ?? undefined,
    response_text: row.response_text ?? undefined,
    responded_at: toIsoString(row.responded_at) ?? undefined,
    created_at: toIsoString(row.created_at) ?? undefined,
    feedback_status: row.feedback_status ?? undefined,
    feedback_status_display: row.feedback_status_display ?? undefined,
    feedback_category: row.feedback_category ?? undefined,
    assigned_to: row.assigned_to ?? undefined,
    assigned_at: toIsoString(row.assigned_at) ?? undefined,
    resolution_notes: row.resolution_notes ?? undefined,
    resolved_at: toIsoString(row.resolved_at) ?? undefined,
    service_recovery_reference: row.service_recovery_reference ?? undefined,
  });
};

export const listGuestFeedback = async (
  options: ListGuestFeedbackInput,
): Promise<GuestFeedbackListItem[]> => {
  const { rows } = await query<GuestFeedbackRow>(GUEST_FEEDBACK_LIST_SQL, [
    options.limit ?? 50,
    options.tenantId,
    options.propertyId ?? null,
    options.sentimentLabel ?? null,
    options.isPublic ?? null,
    options.hasResponse ?? null,
    options.offset ?? 0,
    options.feedbackStatus ?? null,
    options.feedbackCategory ?? null,
  ]);

  return rows.map(mapGuestFeedbackRow);
};

export const getGuestFeedbackById = async (
  options: GetGuestFeedbackInput,
): Promise<GuestFeedbackListItem | null> => {
  const { rows } = await query<GuestFeedbackRow>(GUEST_FEEDBACK_BY_ID_SQL, [
    options.feedbackId,
    options.tenantId,
  ]);

  if (rows.length === 0) {
    return null;
  }

  return mapGuestFeedbackRow(rows[0] as NonNullable<(typeof rows)[0]>);
};

// =====================================================
// GUEST FEEDBACK — WRITE PATH
//
// The register was read-only: two GETs over a table nothing could create a row
// in, so there was no intake (not from the portal, not from staff on a phone
// complaint) and no response loop. Per ui-gaps/18-write-path-gap.md this is one
// service, one table, no fan-out — so plain HTTP, not a command.
// See ui-gaps/09-guest-feedback.md.
// =====================================================

/**
 * Log a piece of feedback.
 *
 * `guest_id` and `reservation_id` are optional because the table's NOT NULL on
 * both is exactly what made staff-entered intake impossible — a caller
 * complaining about last night has neither to hand.
 */
export const createGuestFeedback = async (
  tenantId: string,
  input: GuestFeedbackWriteInput,
): Promise<GuestFeedbackListItem | null> => {
  const { rows } = await query<{ id: string }>(
    `
      INSERT INTO public.guest_feedback (
        tenant_id, property_id, guest_id, reservation_id,
        feedback_source, review_title, review_text,
        overall_rating, rating_scale,
        cleanliness_rating, staff_rating, location_rating, value_rating,
        would_recommend, would_return,
        feedback_category, sentiment_label,
        is_public, language_code,
        feedback_status
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid,
        $5, $6, $7,
        $8, COALESCE($9, 5),
        $10, $11, $12, $13,
        $14, $15,
        $16, $17,
        COALESCE($18, true), COALESCE($19, 'en'),
        'new'
      )
      RETURNING id
    `,
    [
      tenantId,
      input.propertyId,
      input.guestId ?? null,
      input.reservationId ?? null,
      input.feedbackSource,
      input.reviewTitle ?? null,
      input.reviewText,
      input.overallRating ?? null,
      input.ratingScale ?? null,
      input.cleanlinessRating ?? null,
      input.staffRating ?? null,
      input.locationRating ?? null,
      input.valueRating ?? null,
      input.wouldRecommend ?? null,
      input.wouldReturn ?? null,
      input.feedbackCategory ?? null,
      input.sentimentLabel ?? null,
      input.isPublic ?? null,
      input.languageCode ?? null,
    ],
  );

  const feedbackId = rows[0]?.id;
  if (!feedbackId) return null;

  return getGuestFeedbackById({ feedbackId, tenantId });
};

/**
 * Log feedback submitted through the guest portal.
 *
 * The confirmation code is the credential — the portal is unauthenticated, so a
 * caller-supplied `guest_id` would let anyone attribute feedback to any guest.
 * Guest, property and stay are derived from the reservation the code resolves to,
 * and the source is fixed to GUEST_PORTAL rather than being caller-settable.
 *
 * Returns null when the code matches nothing; the route reports that as a 404
 * without echoing whether the code merely belongs to another tenant.
 */
export const createSelfServiceFeedback = async (
  tenantId: string,
  input: {
    confirmationCode: string;
    reviewText: string;
    reviewTitle?: string;
    overallRating?: number;
    cleanlinessRating?: number;
    staffRating?: number;
    locationRating?: number;
    valueRating?: number;
    wouldRecommend?: boolean;
    wouldReturn?: boolean;
  },
): Promise<GuestFeedbackListItem | null> => {
  const { rows } = await query<{ id: string; guest_id: string; property_id: string }>(
    `SELECT r.id, r.guest_id, r.property_id
       FROM public.reservations r
      WHERE r.tenant_id = $1::uuid
        AND UPPER(r.confirmation_number) = UPPER($2)
        AND COALESCE(r.is_deleted, false) = false
        AND r.deleted_at IS NULL
      LIMIT 1`,
    [tenantId, input.confirmationCode],
  );

  const reservation = rows[0];
  if (!reservation) return null;

  return createGuestFeedback(tenantId, {
    propertyId: reservation.property_id,
    feedbackSource: "GUEST_PORTAL",
    reviewText: input.reviewText,
    guestId: reservation.guest_id,
    reservationId: reservation.id,
    reviewTitle: input.reviewTitle,
    overallRating: input.overallRating,
    ratingScale: 5,
    cleanlinessRating: input.cleanlinessRating,
    staffRating: input.staffRating,
    locationRating: input.locationRating,
    valueRating: input.valueRating,
    wouldRecommend: input.wouldRecommend,
    wouldReturn: input.wouldReturn,
    // Guest-submitted text is not published until someone has read it.
    isPublic: false,
  });
};

/**
 * Triage: categorise, set sentiment, assign an owner, adjust publication.
 *
 * `COALESCE` keeps the stored value when a field is absent, so a screen can send
 * only what changed. Assigning stamps `assigned_at` in the same statement —
 * an owner with no timestamp cannot be aged.
 */
export const updateGuestFeedback = async (
  tenantId: string,
  feedbackId: string,
  input: {
    feedbackCategory?: string;
    sentimentLabel?: string;
    feedbackStatus?: string;
    assignedTo?: string;
    isPublic?: boolean;
    isFeatured?: boolean;
    isVerified?: boolean;
  },
): Promise<GuestFeedbackListItem | null> => {
  const { rowCount } = await query(
    `
      UPDATE public.guest_feedback
      SET
        feedback_category = COALESCE($3, feedback_category),
        sentiment_label = COALESCE($4, sentiment_label),
        feedback_status = COALESCE($5, feedback_status),
        assigned_to = COALESCE($6::uuid, assigned_to),
        assigned_at = CASE
          WHEN $6::uuid IS NOT NULL AND $6::uuid IS DISTINCT FROM assigned_to
          THEN CURRENT_TIMESTAMP ELSE assigned_at
        END,
        is_public = COALESCE($7, is_public),
        is_featured = COALESCE($8, is_featured),
        is_verified = COALESCE($9, is_verified),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1::uuid AND tenant_id = $2::uuid
    `,
    [
      feedbackId,
      tenantId,
      input.feedbackCategory ?? null,
      input.sentimentLabel ?? null,
      input.feedbackStatus ?? null,
      input.assignedTo ?? null,
      input.isPublic ?? null,
      input.isFeatured ?? null,
      input.isVerified ?? null,
    ],
  );

  if (!rowCount) return null;

  return getGuestFeedbackById({ feedbackId, tenantId });
};

/**
 * Record the response sent to the guest.
 *
 * The status only advances to `responded` from a state that precedes it —
 * responding again to something already resolved should not reopen it.
 */
export const respondToGuestFeedback = async (
  tenantId: string,
  feedbackId: string,
  input: { responseText: string; isPublic?: boolean },
  actorId?: string,
): Promise<GuestFeedbackListItem | null> => {
  const { rowCount } = await query(
    `
      UPDATE public.guest_feedback
      SET
        response_text = $3,
        responded_by = $4::uuid,
        responded_at = CURRENT_TIMESTAMP,
        is_public = COALESCE($5, is_public),
        feedback_status = CASE
          WHEN feedback_status IN ('new', 'acknowledged', 'in_progress')
          THEN 'responded' ELSE feedback_status
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1::uuid AND tenant_id = $2::uuid
    `,
    [feedbackId, tenantId, input.responseText, actorId ?? null, input.isPublic ?? null],
  );

  if (!rowCount) return null;

  return getGuestFeedbackById({ feedbackId, tenantId });
};

/** Close the loop, optionally linking the goodwill gesture that settled it. */
export const resolveGuestFeedback = async (
  tenantId: string,
  feedbackId: string,
  input: {
    resolutionNotes: string;
    serviceRecoveryReference?: string;
    feedbackStatus?: string;
  },
  actorId?: string,
): Promise<GuestFeedbackListItem | null> => {
  const { rowCount } = await query(
    `
      UPDATE public.guest_feedback
      SET
        resolution_notes = $3,
        service_recovery_reference = COALESCE($4, service_recovery_reference),
        feedback_status = COALESCE($5, 'resolved'),
        resolved_by = $6::uuid,
        resolved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1::uuid AND tenant_id = $2::uuid
    `,
    [
      feedbackId,
      tenantId,
      input.resolutionNotes,
      input.serviceRecoveryReference ?? null,
      input.feedbackStatus ?? null,
      actorId ?? null,
    ],
  );

  if (!rowCount) return null;

  return getGuestFeedbackById({ feedbackId, tenantId });
};

// =====================================================
// POLICE REPORTS
// =====================================================

const mapPoliceReportRow = (row: PoliceReportRow): PoliceReportListItem => {
  return PoliceReportListItemSchema.parse({
    report_id: row.report_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    report_number: row.report_number,
    police_case_number: row.police_case_number ?? undefined,
    incident_id: row.incident_id ?? undefined,
    incident_date: toIsoString(row.incident_date) ?? "",
    incident_time: row.incident_time ?? undefined,
    reported_date: toIsoString(row.reported_date) ?? "",
    incident_type: row.incident_type ?? undefined,
    incident_type_display: row.incident_type_display ?? undefined,
    incident_description: row.incident_description,
    incident_location: row.incident_location ?? undefined,
    room_number: row.room_number ?? undefined,
    agency_name: row.agency_name,
    responding_officer_name: row.responding_officer_name ?? undefined,
    report_status: row.report_status,
    report_status_display: row.report_status_display,
    suspect_count: row.suspect_count ?? undefined,
    victim_count: row.victim_count ?? undefined,
    guest_involved: row.guest_involved ?? undefined,
    staff_involved: row.staff_involved ?? undefined,
    property_stolen: row.property_stolen ?? undefined,
    total_loss_value: row.total_loss_value ?? undefined,
    arrests_made: row.arrests_made ?? undefined,
    investigation_ongoing: row.investigation_ongoing ?? undefined,
    resolved: row.resolved ?? undefined,
    confidential: row.confidential ?? undefined,
    created_at: toIsoString(row.created_at) ?? undefined,
  });
};

export const listPoliceReports = async (
  options: ListPoliceReportsInput,
): Promise<PoliceReportListItem[]> => {
  const { rows } = await query<PoliceReportRow>(POLICE_REPORT_LIST_SQL, [
    options.limit ?? 50,
    options.tenantId,
    options.propertyId ?? null,
    options.reportStatus ?? null,
    options.incidentType ?? null,
    options.incidentDateFrom ?? null,
    options.offset ?? 0,
  ]);

  return rows.map(mapPoliceReportRow);
};

export const getPoliceReportById = async (
  options: GetPoliceReportInput,
): Promise<PoliceReportListItem | null> => {
  const { rows } = await query<PoliceReportRow>(POLICE_REPORT_BY_ID_SQL, [
    options.reportId,
    options.tenantId,
  ]);

  if (rows.length === 0) {
    return null;
  }

  return mapPoliceReportRow(rows[0] as NonNullable<(typeof rows)[0]>);
};

/** `PR-YYYYMMDD-XXXX`, matching the confirmation-number style used elsewhere. */
const buildReportNumber = (): string => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PR-${datePart}-${random}`;
};

/**
 * File a police report.
 *
 * The register was read-only until 2026-08-11 — two GETs over a table nothing
 * could write to, so it stayed empty and reports lived on paper. See
 * ui-gaps/02-police-reports.md.
 */
export const createPoliceReport = async (
  tenantId: string,
  input: PoliceReportWriteInput,
  actorId?: string,
): Promise<PoliceReportListItem | null> => {
  const { rows } = await query<{ report_id: string }>(
    `
      INSERT INTO public.police_reports (
        tenant_id, property_id, report_number,
        incident_id, incident_date, incident_time,
        reported_date, incident_type, incident_description,
        incident_location, room_number,
        agency_name, agency_jurisdiction, agency_contact_number,
        responding_officer_name, responding_officer_badge,
        report_status,
        guest_involved, staff_involved, property_stolen,
        total_loss_value, injuries_reported,
        created_by, updated_by
      ) VALUES (
        $1::uuid, $2::uuid, $3,
        $4::uuid, $5::date, $6::time,
        COALESCE($7::date, CURRENT_DATE), $8, $9,
        $10, $11,
        $12, $13, $14,
        $15, $16,
        'filed',
        COALESCE($17, false), COALESCE($18, false), COALESCE($19, false),
        $20, COALESCE($21, false),
        $22, $22
      )
      RETURNING report_id
    `,
    [
      tenantId,
      input.propertyId,
      buildReportNumber(),
      input.incidentId ?? null,
      input.incidentDate,
      input.incidentTime ?? null,
      input.reportedDate ?? null,
      input.incidentType ?? null,
      input.incidentDescription,
      input.incidentLocation ?? null,
      input.roomNumber ?? null,
      input.agencyName,
      input.agencyJurisdiction ?? null,
      input.agencyContactNumber ?? null,
      input.respondingOfficerName ?? null,
      input.respondingOfficerBadge ?? null,
      input.guestInvolved ?? null,
      input.staffInvolved ?? null,
      input.propertyStolen ?? null,
      input.totalLossValue ?? null,
      input.injuriesReported ?? null,
      actorId ?? null,
    ],
  );

  const reportId = rows[0]?.report_id;
  if (!reportId) return null;

  return getPoliceReportById({ reportId, tenantId });
};

/**
 * Correct a filed report.
 *
 * Every field is optional and `COALESCE` keeps the stored value when one is
 * absent, so a screen can send only what changed. `report_number` and
 * `report_status` are not settable here — the number is immutable and the status
 * moves through {@link updatePoliceReportStatus}, which also carries the police
 * case number that justifies the transition.
 */
export const updatePoliceReport = async (
  tenantId: string,
  reportId: string,
  input: Partial<PoliceReportWriteInput>,
  actorId?: string,
): Promise<PoliceReportListItem | null> => {
  const { rowCount } = await query(
    `
      UPDATE public.police_reports
      SET
        incident_id = COALESCE($3::uuid, incident_id),
        incident_date = COALESCE($4::date, incident_date),
        incident_time = COALESCE($5::time, incident_time),
        incident_type = COALESCE($6, incident_type),
        incident_description = COALESCE($7, incident_description),
        incident_location = COALESCE($8, incident_location),
        room_number = COALESCE($9, room_number),
        agency_name = COALESCE($10, agency_name),
        agency_jurisdiction = COALESCE($11, agency_jurisdiction),
        agency_contact_number = COALESCE($12, agency_contact_number),
        responding_officer_name = COALESCE($13, responding_officer_name),
        responding_officer_badge = COALESCE($14, responding_officer_badge),
        guest_involved = COALESCE($15, guest_involved),
        staff_involved = COALESCE($16, staff_involved),
        property_stolen = COALESCE($17, property_stolen),
        total_loss_value = COALESCE($18, total_loss_value),
        injuries_reported = COALESCE($19, injuries_reported),
        updated_at = NOW(),
        updated_by = $20
      WHERE tenant_id = $1::uuid
        AND report_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      tenantId,
      reportId,
      input.incidentId ?? null,
      input.incidentDate ?? null,
      input.incidentTime ?? null,
      input.incidentType ?? null,
      input.incidentDescription ?? null,
      input.incidentLocation ?? null,
      input.roomNumber ?? null,
      input.agencyName ?? null,
      input.agencyJurisdiction ?? null,
      input.agencyContactNumber ?? null,
      input.respondingOfficerName ?? null,
      input.respondingOfficerBadge ?? null,
      input.guestInvolved ?? null,
      input.staffInvolved ?? null,
      input.propertyStolen ?? null,
      input.totalLossValue ?? null,
      input.injuriesReported ?? null,
      actorId ?? null,
    ],
  );

  if (!rowCount) return null;

  return getPoliceReportById({ reportId, tenantId });
};

/**
 * Move a report through its status, recording the police case number.
 *
 * The case number is what makes a report traceable back to the force's own
 * record, so it is captured with the transition rather than as a later edit.
 */
export const updatePoliceReportStatus = async (
  tenantId: string,
  reportId: string,
  input: PoliceReportStatusInput,
  actorId?: string,
): Promise<PoliceReportListItem | null> => {
  const { rowCount } = await query(
    `
      UPDATE public.police_reports
      SET
        report_status = $3::text,
        police_case_number = COALESCE($4, police_case_number),
        lead_investigator_name = COALESCE($5, lead_investigator_name),
        -- Both uses of $3 need the same cast, or Postgres deduces two types for
        -- one parameter and rejects the statement outright.
        investigation_ongoing = ($3::text IN ('under_investigation', 'referred')),
        follow_up_required = COALESCE($6, follow_up_required),
        follow_up_date = COALESCE($7::date, follow_up_date),
        updated_at = NOW(),
        updated_by = $8
      WHERE tenant_id = $1::uuid
        AND report_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      tenantId,
      reportId,
      input.reportStatus,
      input.policeCaseNumber ?? null,
      input.leadInvestigatorName ?? null,
      input.followUpRequired ?? null,
      input.followUpDate ?? null,
      actorId ?? null,
    ],
  );

  if (!rowCount) return null;

  return getPoliceReportById({ reportId, tenantId });
};
