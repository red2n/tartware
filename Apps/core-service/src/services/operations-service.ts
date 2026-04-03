/**
 * Operations Service
 * Purpose: Service functions for cashier sessions, shift handovers, lost & found,
 *          banquet orders, guest feedback, and police reports
 */

import {
  type BanquetOrderListItem,
  BanquetOrderListItemSchema,
  type BanquetOrderRow,
  type CashierSessionListItem,
  CashierSessionListItemSchema,
  type CashierSessionRow,
  type GetBanquetOrderInput,
  type GetCashierSessionInput,
  type GetGuestFeedbackInput,
  type GetLostFoundInput,
  type GetPoliceReportInput,
  type GetShiftHandoverInput,
  type GuestFeedbackListItem,
  GuestFeedbackListItemSchema,
  type GuestFeedbackRow,
  type ListBanquetOrdersInput,
  type ListCashierSessionsInput,
  type ListGuestFeedbackInput,
  type ListLostFoundInput,
  type ListPoliceReportsInput,
  type ListShiftHandoversInput,
  type LostFoundListItem,
  LostFoundListItemSchema,
  type LostFoundRow,
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
  LOST_FOUND_BY_ID_SQL,
  LOST_FOUND_LIST_SQL,
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

  return mapCashierSessionRow(rows[0]!);
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

  return mapShiftHandoverRow(rows[0]!);
};

// =====================================================
// LOST AND FOUND
// =====================================================

const mapLostFoundRow = (row: LostFoundRow): LostFoundListItem => {
  return LostFoundListItemSchema.parse({
    item_id: row.item_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    item_number: row.item_number ?? undefined,
    item_name: row.item_name,
    item_description: row.item_description,
    item_category: row.item_category,
    item_category_display: row.item_category_display,
    color: row.color ?? undefined,
    estimated_value: row.estimated_value ?? undefined,
    is_valuable: row.is_valuable ?? undefined,
    found_date: toIsoString(row.found_date) ?? "",
    found_by_name: row.found_by_name ?? undefined,
    found_location: row.found_location,
    room_number: row.room_number ?? undefined,
    guest_name: row.guest_name ?? undefined,
    item_status: row.item_status,
    item_status_display: row.item_status_display,
    storage_location: row.storage_location ?? undefined,
    days_in_storage: row.days_in_storage ?? undefined,
    claimed: row.claimed ?? undefined,
    returned: row.returned ?? undefined,
    disposed: row.disposed ?? undefined,
    hold_until_date: toIsoString(row.hold_until_date) ?? undefined,
    has_photos: row.has_photos ?? undefined,
    created_at: toIsoString(row.created_at) ?? undefined,
  });
};

export const listLostFoundItems = async (
  options: ListLostFoundInput,
): Promise<LostFoundListItem[]> => {
  const { rows } = await query<LostFoundRow>(LOST_FOUND_LIST_SQL, [
    options.limit ?? 50,
    options.tenantId,
    options.propertyId ?? null,
    options.itemStatus ?? null,
    options.itemCategory ?? null,
    options.foundDateFrom ?? null,
    options.offset ?? 0,
  ]);

  return rows.map(mapLostFoundRow);
};

export const getLostFoundItemById = async (
  options: GetLostFoundInput,
): Promise<LostFoundListItem | null> => {
  const { rows } = await query<LostFoundRow>(LOST_FOUND_BY_ID_SQL, [
    options.itemId,
    options.tenantId,
  ]);

  if (rows.length === 0) {
    return null;
  }

  return mapLostFoundRow(rows[0]!);
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
): Promise<BanquetOrderListItem | null> => {
  const { rows } = await query<BanquetOrderRow>(BANQUET_ORDER_BY_ID_SQL, [
    options.beoId,
    options.tenantId,
  ]);

  if (rows.length === 0) {
    return null;
  }

  return mapBanquetOrderRow(rows[0]!);
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
    guest_id: row.guest_id,
    guest_name: row.guest_name ?? undefined,
    reservation_id: row.reservation_id,
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

  return mapGuestFeedbackRow(rows[0]!);
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

  return mapPoliceReportRow(rows[0]!);
};
