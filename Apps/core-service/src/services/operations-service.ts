/**
 * Operations Service
 * Purpose: Service functions for cashier sessions, shift handovers, lost & found,
 *          banquet orders, guest feedback, and police reports
 */

import {
  type BanquetOrderListItem,
  BanquetOrderListItemSchema,
  type CashierSessionListItem,
  CashierSessionListItemSchema,
  type GuestFeedbackListItem,
  GuestFeedbackListItemSchema,
  type LostFoundListItem,
  LostFoundListItemSchema,
  type PoliceReportListItem,
  PoliceReportListItemSchema,
  type ShiftHandoverListItem,
  ShiftHandoverListItemSchema,
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

type CashierSessionRow = {
  session_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  session_number: string;
  session_name: string | null;
  cashier_id: string;
  cashier_name: string | null;
  terminal_id: string | null;
  terminal_name: string | null;
  location: string | null;
  session_status: string;
  session_status_display: string;
  opened_at: Date | string;
  closed_at: Date | string | null;
  business_date: Date | string;
  shift_type: string | null;
  opening_float_declared: string;
  total_transactions: number | null;
  total_revenue: string | null;
  total_refunds: string | null;
  net_revenue: string | null;
  expected_cash_balance: string | null;
  closing_cash_counted: string | null;
  cash_variance: string | null;
  has_variance: boolean | null;
  reconciled: boolean | null;
  approved: boolean | null;
  created_at: Date | string | null;
};

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

export type ListCashierSessionsInput = {
  tenantId: string;
  propertyId?: string;
  sessionStatus?: string;
  businessDate?: string;
  cashierId?: string;
  limit?: number;
  offset?: number;
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

export type GetCashierSessionInput = {
  sessionId: string;
  tenantId: string;
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

type ShiftHandoverRow = {
  handover_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  handover_number: string | null;
  handover_title: string | null;
  shift_date: Date | string;
  outgoing_shift: string;
  outgoing_user_id: string;
  outgoing_user_name: string | null;
  incoming_shift: string;
  incoming_user_id: string;
  incoming_user_name: string | null;
  department: string;
  department_display: string;
  handover_status: string;
  handover_status_display: string;
  handover_started_at: Date | string | null;
  handover_completed_at: Date | string | null;
  current_occupancy_percent: string | null;
  expected_arrivals_count: number | null;
  expected_departures_count: number | null;
  tasks_pending: number | null;
  tasks_urgent: number | null;
  key_points: string;
  requires_follow_up: boolean | null;
  acknowledged: boolean | null;
  created_at: Date | string | null;
};

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

export type ListShiftHandoversInput = {
  tenantId: string;
  propertyId?: string;
  handoverStatus?: string;
  shiftDate?: string;
  department?: string;
  limit?: number;
  offset?: number;
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

export type GetShiftHandoverInput = {
  handoverId: string;
  tenantId: string;
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

type LostFoundRow = {
  item_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  item_number: string | null;
  item_name: string;
  item_description: string;
  item_category: string;
  item_category_display: string;
  color: string | null;
  estimated_value: string | null;
  is_valuable: boolean | null;
  found_date: Date | string;
  found_by_name: string | null;
  found_location: string;
  room_number: string | null;
  guest_name: string | null;
  item_status: string;
  item_status_display: string;
  storage_location: string | null;
  days_in_storage: number | null;
  claimed: boolean | null;
  returned: boolean | null;
  disposed: boolean | null;
  hold_until_date: Date | string | null;
  has_photos: boolean | null;
  created_at: Date | string | null;
};

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

export type ListLostFoundInput = {
  tenantId: string;
  propertyId?: string;
  itemStatus?: string;
  itemCategory?: string;
  foundDateFrom?: string;
  limit?: number;
  offset?: number;
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

export type GetLostFoundInput = {
  itemId: string;
  tenantId: string;
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

type BanquetOrderRow = {
  beo_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  event_booking_id: string;
  beo_number: string;
  beo_version: number | null;
  beo_status: string;
  beo_status_display: string;
  event_date: Date | string;
  event_start_time: string;
  event_end_time: string;
  meeting_room_id: string;
  meeting_room_name: string | null;
  room_setup: string;
  room_setup_display: string;
  guaranteed_count: number;
  expected_count: number | null;
  actual_count: number | null;
  menu_type: string | null;
  service_style: string | null;
  bar_type: string | null;
  food_subtotal: string | null;
  beverage_subtotal: string | null;
  total_estimated: string | null;
  total_actual: string | null;
  client_approved: boolean | null;
  chef_approved: boolean | null;
  manager_approved: boolean | null;
  setup_completed: boolean | null;
  event_started: boolean | null;
  event_ended: boolean | null;
  created_at: Date | string;
};

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

export type ListBanquetOrdersInput = {
  tenantId: string;
  propertyId?: string;
  beoStatus?: string;
  eventDate?: string;
  meetingRoomId?: string;
  limit?: number;
  offset?: number;
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

export type GetBanquetOrderInput = {
  beoId: string;
  tenantId: string;
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

type GuestFeedbackRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  guest_id: string;
  guest_name: string | null;
  reservation_id: string;
  feedback_source: string | null;
  feedback_source_display: string | null;
  overall_rating: string | null;
  rating_scale: number | null;
  cleanliness_rating: string | null;
  staff_rating: string | null;
  location_rating: string | null;
  value_rating: string | null;
  review_title: string | null;
  review_text: string | null;
  would_recommend: boolean | null;
  would_return: boolean | null;
  sentiment_label: string | null;
  is_verified: boolean | null;
  is_public: boolean | null;
  is_featured: boolean | null;
  response_text: string | null;
  responded_at: Date | string | null;
  created_at: Date | string | null;
};

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

export type ListGuestFeedbackInput = {
  tenantId: string;
  propertyId?: string;
  sentimentLabel?: string;
  isPublic?: boolean;
  hasResponse?: boolean;
  limit?: number;
  offset?: number;
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

export type GetGuestFeedbackInput = {
  feedbackId: string;
  tenantId: string;
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

type PoliceReportRow = {
  report_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  report_number: string;
  police_case_number: string | null;
  incident_id: string | null;
  incident_date: Date | string;
  incident_time: string | null;
  reported_date: Date | string;
  incident_type: string | null;
  incident_type_display: string | null;
  incident_description: string;
  incident_location: string | null;
  room_number: string | null;
  agency_name: string;
  responding_officer_name: string | null;
  report_status: string;
  report_status_display: string;
  suspect_count: number | null;
  victim_count: number | null;
  guest_involved: boolean | null;
  staff_involved: boolean | null;
  property_stolen: boolean | null;
  total_loss_value: string | null;
  arrests_made: boolean | null;
  investigation_ongoing: boolean | null;
  resolved: boolean | null;
  confidential: boolean | null;
  created_at: Date | string | null;
};

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

export type ListPoliceReportsInput = {
  tenantId: string;
  propertyId?: string;
  reportStatus?: string;
  incidentType?: string;
  incidentDateFrom?: string;
  limit?: number;
  offset?: number;
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

export type GetPoliceReportInput = {
  reportId: string;
  tenantId: string;
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
