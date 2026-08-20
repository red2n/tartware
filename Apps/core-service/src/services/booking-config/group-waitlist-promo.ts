import {
  type GetGroupBookingInput,
  type GetPromotionalCodeInput,
  type GetWaitlistEntryInput,
  type GroupBookingDetail,
  type GroupBookingListItem,
  GroupBookingListItemSchema,
  type GroupBookingRow,
  type GroupRoomBlock,
  type GroupRoomBlockRow,
  GroupRoomBlockSchema,
  type ListGroupBookingsInput,
  type ListPromotionalCodesInput,
  type ListWaitlistEntriesInput,
  type PromotionalCodeListItem,
  PromotionalCodeListItemSchema,
  type PromotionalCodeRow,
  type PromotionalCodeWriteInput,
  type ValidatePromoCodeInput,
  type WaitlistEntryListItem,
  WaitlistEntryListItemSchema,
  type WaitlistEntryRow,
} from "@tartware/schemas";

import { query } from "../../lib/db.js";
import {
  GROUP_BOOKING_BY_ID_SQL,
  GROUP_BOOKING_LIST_SQL,
  GROUP_ROOM_BLOCKS_BY_BOOKING_SQL,
  PROMOTIONAL_CODE_BY_CODE_SQL,
  PROMOTIONAL_CODE_BY_ID_SQL,
  PROMOTIONAL_CODE_LIST_SQL,
  WAITLIST_ENTRY_BY_ID_SQL,
  WAITLIST_ENTRY_LIST_SQL,
} from "../../sql/booking-config/group-waitlist-promo.js";

import {
  formatDisplayLabel,
  isUniqueViolationOn,
  ReferenceCodeConflictError,
  toIsoString,
  toNumber,
} from "./common.js";

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

const mapGroupRoomBlockRow = (row: GroupRoomBlockRow): GroupRoomBlock =>
  GroupRoomBlockSchema.parse({
    block_id: row.block_id,
    room_type_id: row.room_type_id,
    room_type_name: row.room_type_name ?? undefined,
    block_date: (toIsoString(row.block_date) ?? "").split("T")[0],
    blocked_rooms: row.blocked_rooms ?? 0,
    picked_rooms: row.picked_rooms ?? 0,
    confirmed_rooms: row.confirmed_rooms ?? 0,
    negotiated_rate: toNumber(row.negotiated_rate),
    rack_rate: toNumber(row.rack_rate),
    discount_percentage: toNumber(row.discount_percentage),
    block_status: row.block_status,
  });

/**
 * Room blocks held against a group booking, ordered by date then room type.
 */
export const listGroupRoomBlocks = async (
  options: GetGroupBookingInput,
): Promise<GroupRoomBlock[]> => {
  const { rows } = await query<GroupRoomBlockRow>(GROUP_ROOM_BLOCKS_BY_BOOKING_SQL, [
    options.groupBookingId,
    options.tenantId,
  ]);
  return rows.map(mapGroupRoomBlockRow);
};

/**
 * Group booking detail — the booking plus the room blocks held against it.
 *
 * Composed from the two single-purpose readers above rather than a joined
 * query, so each keeps a flat row shape and either can be reused alone.
 */
export const getGroupBookingDetail = async (
  options: GetGroupBookingInput,
): Promise<GroupBookingDetail | null> => {
  const booking = await getGroupBookingById(options);
  if (!booking) {
    return null;
  }
  const roomBlocks = await listGroupRoomBlocks(options);
  return { ...booking, room_blocks: roomBlocks };
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

// =====================================================
// PROMOTIONAL CODES — WRITE PATH
//
// `POST /v1/promo-codes/validate` has always worked, so codes could be *used*
// and never *created*: the redemption path was live over a table only SQL could
// populate. Per ui-gaps/18-write-path-gap.md this is reference data on one
// service with no fan-out, so plain HTTP.
// See ui-gaps/16-booking-reference-data.md.
// =====================================================

/**
 * Create a promotional code.
 *
 * `remaining_uses` is seeded from the limit so the redemption path has a counter
 * to decrement from the moment the code exists, rather than treating NULL as
 * "unlimited" on a code that has one. Usage and analytics counters start at
 * their defaults and are never caller-settable.
 */
export const createPromotionalCode = async (
  tenantId: string,
  input: PromotionalCodeWriteInput,
  actorId?: string,
): Promise<PromotionalCodeListItem | null> => {
  // `uq_promotional_codes_tenant_code` is the constraint COV-16 added; a code an
  // operator has already used is a 409, not a 500. Same handling as booking
  // sources and market segments in booking-config/distribution.ts.
  let rows: { promo_id: string }[];
  try {
    ({ rows } = await query<{ promo_id: string }>(
      `
      INSERT INTO public.promotional_codes (
        tenant_id, property_id,
        promo_code, promo_name, promo_description,
        promo_type, promo_status, is_active, is_public,
        valid_from, valid_to,
        discount_type, discount_percent, discount_amount, discount_currency,
        max_discount_amount, free_nights_count,
        has_usage_limit, total_usage_limit, remaining_uses, per_user_limit,
        minimum_stay_nights, maximum_stay_nights, minimum_booking_amount,
        combinable_with_other_promos, auto_apply, display_on_website,
        created_by, updated_by
      ) VALUES (
        $1::uuid, $2::uuid,
        $3, $4, $5,
        $6, COALESCE($7, 'draft'), COALESCE($8, true), COALESCE($9, false),
        $10::date, $11::date,
        $12, $13, $14, COALESCE($15, 'USD'),
        $16, $17,
        COALESCE($18, false), $19, $19, COALESCE($20, 1),
        $21, $22, $23,
        COALESCE($24, false), COALESCE($25, false), COALESCE($26, false),
        $27, $27
      )
      RETURNING promo_id
    `,
      [
        tenantId,
        input.propertyId ?? null,
        input.promoCode,
        input.promoName,
        input.promoDescription ?? null,
        input.promoType ?? null,
        input.promoStatus ?? null,
        input.isActive ?? null,
        input.isPublic ?? null,
        input.validFrom,
        input.validTo,
        input.discountType ?? null,
        input.discountPercent ?? null,
        input.discountAmount ?? null,
        input.discountCurrency ?? null,
        input.maxDiscountAmount ?? null,
        input.freeNightsCount ?? null,
        input.hasUsageLimit ?? null,
        input.totalUsageLimit ?? null,
        input.perUserLimit ?? null,
        input.minimumStayNights ?? null,
        input.maximumStayNights ?? null,
        input.minimumBookingAmount ?? null,
        input.combinableWithOtherPromos ?? null,
        input.autoApply ?? null,
        input.displayOnWebsite ?? null,
        actorId ?? null,
      ],
    ));
  } catch (error) {
    if (isUniqueViolationOn(error, "uq_promotional_codes_tenant_code")) {
      throw new ReferenceCodeConflictError(
        `Promotional code ${input.promoCode} already exists for this tenant`,
      );
    }
    throw error;
  }

  const promoId = rows[0]?.promo_id;
  if (!promoId) return null;

  return getPromotionalCodeById({ promoId, tenantId });
};

/**
 * Edit a promotional code.
 *
 * `promo_code` is deliberately absent: it is the identifier guests already hold,
 * and rewriting it silently invalidates every email and landing page carrying
 * the old one. `remaining_uses` is re-derived when the limit moves, so raising a
 * limit on a part-redeemed code grants the difference rather than resetting it.
 */
export const updatePromotionalCode = async (
  tenantId: string,
  promoId: string,
  input: Partial<PromotionalCodeWriteInput>,
  actorId?: string,
): Promise<PromotionalCodeListItem | null> => {
  const { rowCount } = await query(
    `
      UPDATE public.promotional_codes
      SET
        promo_name = COALESCE($3, promo_name),
        promo_description = COALESCE($4, promo_description),
        promo_type = COALESCE($5, promo_type),
        promo_status = COALESCE($6, promo_status),
        is_active = COALESCE($7, is_active),
        is_public = COALESCE($8, is_public),
        valid_from = COALESCE($9::date, valid_from),
        valid_to = COALESCE($10::date, valid_to),
        discount_type = COALESCE($11, discount_type),
        discount_percent = COALESCE($12, discount_percent),
        discount_amount = COALESCE($13, discount_amount),
        discount_currency = COALESCE($14, discount_currency),
        max_discount_amount = COALESCE($15, max_discount_amount),
        free_nights_count = COALESCE($16, free_nights_count),
        has_usage_limit = COALESCE($17, has_usage_limit),
        total_usage_limit = COALESCE($18, total_usage_limit),
        remaining_uses = CASE
          WHEN $18::integer IS NULL THEN remaining_uses
          ELSE GREATEST($18::integer - COALESCE(usage_count, 0), 0)
        END,
        per_user_limit = COALESCE($19, per_user_limit),
        minimum_stay_nights = COALESCE($20, minimum_stay_nights),
        maximum_stay_nights = COALESCE($21, maximum_stay_nights),
        minimum_booking_amount = COALESCE($22, minimum_booking_amount),
        combinable_with_other_promos = COALESCE($23, combinable_with_other_promos),
        auto_apply = COALESCE($24, auto_apply),
        display_on_website = COALESCE($25, display_on_website),
        updated_by = $26,
        updated_at = CURRENT_TIMESTAMP
      WHERE promo_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      promoId,
      tenantId,
      input.promoName ?? null,
      input.promoDescription ?? null,
      input.promoType ?? null,
      input.promoStatus ?? null,
      input.isActive ?? null,
      input.isPublic ?? null,
      input.validFrom ?? null,
      input.validTo ?? null,
      input.discountType ?? null,
      input.discountPercent ?? null,
      input.discountAmount ?? null,
      input.discountCurrency ?? null,
      input.maxDiscountAmount ?? null,
      input.freeNightsCount ?? null,
      input.hasUsageLimit ?? null,
      input.totalUsageLimit ?? null,
      input.perUserLimit ?? null,
      input.minimumStayNights ?? null,
      input.maximumStayNights ?? null,
      input.minimumBookingAmount ?? null,
      input.combinableWithOtherPromos ?? null,
      input.autoApply ?? null,
      input.displayOnWebsite ?? null,
      actorId ?? null,
    ],
  );

  if (!rowCount) return null;

  return getPromotionalCodeById({ promoId, tenantId });
};

/**
 * Withdraw a promotional code.
 *
 * Soft delete, and `is_active` is cleared in the same statement: the validate
 * path filters on `is_deleted`, but anything reading the row directly would
 * otherwise still see an "active" code that cannot be redeemed. Redemption
 * history is why the row stays.
 */
export const deletePromotionalCode = async (
  tenantId: string,
  promoId: string,
  actorId?: string,
): Promise<boolean> => {
  const { rowCount } = await query(
    `
      UPDATE public.promotional_codes
      SET is_deleted = true,
          is_active = false,
          promo_status = 'cancelled',
          updated_by = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE promo_id = $1::uuid AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [promoId, tenantId, actorId ?? null],
  );

  return (rowCount ?? 0) > 0;
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
