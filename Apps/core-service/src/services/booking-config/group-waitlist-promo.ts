import {
  type GetGroupBookingInput,
  type GetPromotionalCodeInput,
  type GetWaitlistEntryInput,
  type GroupBookingListItem,
  GroupBookingListItemSchema,
  type GroupBookingRow,
  type ListGroupBookingsInput,
  type ListPromotionalCodesInput,
  type ListWaitlistEntriesInput,
  type PromotionalCodeListItem,
  PromotionalCodeListItemSchema,
  type PromotionalCodeRow,
  type ValidatePromoCodeInput,
  type WaitlistEntryListItem,
  WaitlistEntryListItemSchema,
  type WaitlistEntryRow,
} from "@tartware/schemas";

import { query } from "../../lib/db.js";
import {
  GROUP_BOOKING_BY_ID_SQL,
  GROUP_BOOKING_LIST_SQL,
  PROMOTIONAL_CODE_BY_CODE_SQL,
  PROMOTIONAL_CODE_BY_ID_SQL,
  PROMOTIONAL_CODE_LIST_SQL,
  WAITLIST_ENTRY_BY_ID_SQL,
  WAITLIST_ENTRY_LIST_SQL,
} from "../../sql/booking-config/group-waitlist-promo.js";

import { formatDisplayLabel, toIsoString } from "./common.js";

// =====================================================
// WAITLIST ENTRY SERVICE
// =====================================================

const mapWaitlistEntryRow = (row: WaitlistEntryRow): WaitlistEntryListItem => {
  return WaitlistEntryListItemSchema.parse({
    waitlist_id: row.waitlist_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    guest_id: row.guest_id ?? undefined,
    guest_name: row.guest_name ?? undefined,
    reservation_id: row.reservation_id ?? undefined,
    requested_room_type_id: row.requested_room_type_id ?? undefined,
    room_type_name: row.room_type_name ?? undefined,
    requested_rate_id: row.requested_rate_id ?? undefined,
    arrival_date: (toIsoString(row.arrival_date) ?? "").split("T")[0],
    departure_date: (toIsoString(row.departure_date) ?? "").split("T")[0],
    nights: row.nights ?? 0,
    number_of_rooms: row.number_of_rooms ?? 1,
    number_of_adults: row.number_of_adults ?? 1,
    number_of_children: row.number_of_children ?? 0,
    flexibility: row.flexibility?.toUpperCase() ?? "NONE",
    flexibility_display: formatDisplayLabel(row.flexibility),
    waitlist_status: row.waitlist_status?.toUpperCase() ?? "ACTIVE",
    waitlist_status_display: formatDisplayLabel(row.waitlist_status),
    priority_score: row.priority_score ?? 0,
    vip_flag: Boolean(row.vip_flag),
    last_notified_at: toIsoString(row.last_notified_at),
    last_notified_via: row.last_notified_via,
    offer_expiration_at: toIsoString(row.offer_expiration_at),
    offer_response: row.offer_response,
    offer_response_at: toIsoString(row.offer_response_at),
    notes: row.notes,
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoString(row.updated_at),
  });
};

export const listWaitlistEntries = async (
  options: ListWaitlistEntriesInput,
): Promise<WaitlistEntryListItem[]> => {
  const { rows } = await query<WaitlistEntryRow>(WAITLIST_ENTRY_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.waitlistStatus ?? null,
    options.arrivalDateFrom ?? null,
    options.arrivalDateTo ?? null,
    options.isVip ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapWaitlistEntryRow);
};

export const getWaitlistEntryById = async (
  options: GetWaitlistEntryInput,
): Promise<WaitlistEntryListItem | null> => {
  const { rows } = await query<WaitlistEntryRow>(WAITLIST_ENTRY_BY_ID_SQL, [
    options.waitlistId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapWaitlistEntryRow(row);
};

// =====================================================
// GROUP BOOKING SERVICE
// =====================================================

const mapGroupBookingRow = (row: GroupBookingRow): GroupBookingListItem => {
  const totalBlocked = row.total_rooms_blocked ?? 0;
  const totalPicked = row.total_rooms_picked ?? 0;
  const pickupPercentage = totalBlocked > 0 ? (totalPicked / totalBlocked) * 100 : 0;

  return GroupBookingListItemSchema.parse({
    group_booking_id: row.group_booking_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    group_name: row.group_name,
    group_code: row.group_code,
    group_type: row.group_type,
    group_type_display: formatDisplayLabel(row.group_type),
    block_status: row.block_status ?? "TENTATIVE",
    block_status_display: formatDisplayLabel(row.block_status ?? "TENTATIVE"),
    company_id: row.company_id ?? undefined,
    company_name: row.company_name ?? undefined,
    organization_name: row.organization_name,
    event_name: row.event_name,
    event_type: row.event_type,
    contact_name: row.contact_name,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    arrival_date: toIsoString(row.arrival_date) ?? "",
    departure_date: toIsoString(row.departure_date) ?? "",
    number_of_nights: row.number_of_nights ?? 0,
    total_rooms_requested: row.total_rooms_requested,
    total_rooms_blocked: totalBlocked,
    total_rooms_picked: totalPicked,
    total_rooms_confirmed: row.total_rooms_confirmed ?? 0,
    pickup_percentage: Math.round(pickupPercentage * 100) / 100,
    cutoff_date: toIsoString(row.cutoff_date) ?? "",
    cutoff_days_before_arrival: row.cutoff_days_before_arrival,
    release_unsold_rooms: row.release_unsold_rooms ?? true,
    rooming_list_received: row.rooming_list_received ?? false,
    rooming_list_deadline: toIsoString(row.rooming_list_deadline) ?? null,
    deposit_amount: row.deposit_amount,
    deposit_received: row.deposit_received ?? false,
    negotiated_rate: row.negotiated_rate,
    estimated_total_revenue: row.estimated_total_revenue,
    actual_revenue: row.actual_revenue,
    contract_signed: row.contract_signed ?? false,
    is_active: row.is_active ?? true,
    booking_confidence: row.booking_confidence,
    account_manager_id: row.account_manager_id ?? undefined,
    account_manager_name: row.account_manager_name ?? undefined,
    sales_manager_id: row.sales_manager_id ?? undefined,
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at) ?? undefined,
  });
};

export const listGroupBookings = async (
  options: ListGroupBookingsInput,
): Promise<GroupBookingListItem[]> => {
  const { rows } = await query<GroupBookingRow>(GROUP_BOOKING_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.blockStatus ?? null,
    options.groupType ?? null,
    options.arrivalDateFrom ?? null,
    options.arrivalDateTo ?? null,
    options.isActive ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapGroupBookingRow);
};

export const getGroupBookingById = async (
  options: GetGroupBookingInput,
): Promise<GroupBookingListItem | null> => {
  const { rows } = await query<GroupBookingRow>(GROUP_BOOKING_BY_ID_SQL, [
    options.groupBookingId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapGroupBookingRow(row);
};

// =====================================================
// PROMOTIONAL CODE SERVICE
// =====================================================

const mapPromotionalCodeRow = (row: PromotionalCodeRow): PromotionalCodeListItem => {
  return PromotionalCodeListItemSchema.parse({
    promo_id: row.promo_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id ?? undefined,
    property_name: row.property_name ?? undefined,
    promo_code: row.promo_code,
    promo_name: row.promo_name,
    promo_description: row.promo_description,
    promo_type: row.promo_type,
    promo_status: row.promo_status ?? "ACTIVE",
    promo_status_display: formatDisplayLabel(row.promo_status ?? "ACTIVE"),
    is_active: row.is_active ?? true,
    is_public: row.is_public ?? false,
    valid_from: toIsoString(row.valid_from) ?? "",
    valid_to: toIsoString(row.valid_to) ?? "",
    discount_type: row.discount_type,
    discount_type_display: row.discount_type ? formatDisplayLabel(row.discount_type) : null,
    discount_percent: row.discount_percent,
    discount_amount: row.discount_amount,
    discount_currency: row.discount_currency,
    max_discount_amount: row.max_discount_amount,
    free_nights_count: row.free_nights_count,
    has_usage_limit: row.has_usage_limit ?? false,
    total_usage_limit: row.total_usage_limit,
    usage_count: row.usage_count ?? 0,
    remaining_uses: row.remaining_uses,
    per_user_limit: row.per_user_limit,
    minimum_stay_nights: row.minimum_stay_nights,
    maximum_stay_nights: row.maximum_stay_nights,
    minimum_booking_amount: row.minimum_booking_amount,
    times_viewed: row.times_viewed ?? 0,
    times_applied: row.times_applied ?? 0,
    times_redeemed: row.times_redeemed ?? 0,
    total_discount_given: row.total_discount_given,
    total_revenue_generated: row.total_revenue_generated,
    conversion_rate: row.conversion_rate,
    combinable_with_other_promos: row.combinable_with_other_promos ?? false,
    auto_apply: row.auto_apply ?? false,
    display_on_website: row.display_on_website ?? false,
    requires_approval: row.requires_approval ?? false,
    campaign_id: row.campaign_id ?? undefined,
    marketing_source: row.marketing_source,
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at) ?? undefined,
  });
};

export const listPromotionalCodes = async (
  options: ListPromotionalCodesInput,
): Promise<PromotionalCodeListItem[]> => {
  const { rows } = await query<PromotionalCodeRow>(PROMOTIONAL_CODE_LIST_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.promoStatus ?? null,
    options.isActive ?? null,
    options.isPublic ?? null,
    options.search ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapPromotionalCodeRow);
};

export const getPromotionalCodeById = async (
  options: GetPromotionalCodeInput,
): Promise<PromotionalCodeListItem | null> => {
  const { rows } = await query<PromotionalCodeRow>(PROMOTIONAL_CODE_BY_ID_SQL, [
    options.promoId,
    options.tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapPromotionalCodeRow(row);
};

export const validatePromoCode = async (
  input: ValidatePromoCodeInput,
): Promise<{
  valid: boolean;
  promoId?: string;
  promoName?: string;
  discountType?: string;
  discountValue?: string;
  message?: string;
  rejectionReason?: string;
}> => {
  const { rows } = await query<PromotionalCodeRow>(PROMOTIONAL_CODE_BY_CODE_SQL, [
    input.promoCode,
    input.tenantId,
    input.propertyId ?? null,
  ]);

  const promo = rows[0];
  if (!promo) {
    return { valid: false, rejectionReason: "Promo code not found" };
  }

  // Check if active
  if (!promo.is_active) {
    return { valid: false, rejectionReason: "Promo code is not active" };
  }

  // Check validity dates
  const now = new Date();
  const validFrom = new Date(promo.valid_from);
  const validTo = new Date(promo.valid_to);
  if (now < validFrom) {
    return { valid: false, rejectionReason: "Promo code is not yet valid" };
  }
  if (now > validTo) {
    return { valid: false, rejectionReason: "Promo code has expired" };
  }

  // Check usage limits
  if (promo.has_usage_limit && promo.remaining_uses !== null && promo.remaining_uses <= 0) {
    return { valid: false, rejectionReason: "Promo code usage limit reached" };
  }

  // Calculate discount value
  let discountValue: string | undefined;
  if (promo.discount_type === "PERCENTAGE" && promo.discount_percent) {
    discountValue = `${promo.discount_percent}%`;
  } else if (promo.discount_type === "FIXED_AMOUNT" && promo.discount_amount) {
    discountValue = `${promo.discount_currency ?? "USD"} ${promo.discount_amount}`;
  } else if (promo.discount_type === "FREE_NIGHTS" && promo.free_nights_count) {
    discountValue = `${promo.free_nights_count} free night(s)`;
  }

  return {
    valid: true,
    promoId: promo.promo_id,
    promoName: promo.promo_name,
    discountType: promo.discount_type ?? undefined,
    discountValue,
    message: `Promo code "${promo.promo_code}" is valid`,
  };
};
