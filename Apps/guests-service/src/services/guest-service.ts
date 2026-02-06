import {
  type GuestCommunicationListItem,
  GuestCommunicationListItemSchema,
  type GuestDocumentListItem,
  GuestDocumentListItemSchema,
  type GuestPreferenceListItem,
  GuestPreferenceListItemSchema,
  type GuestWithStats,
  GuestWithStatsSchema,
} from "@tartware/schemas";

import { applyGuestRetentionPolicy } from "../lib/compliance.js";
import { query } from "../lib/db.js";
import {
  GUEST_COMMUNICATIONS_LIST_SQL,
  GUEST_DOCUMENTS_LIST_SQL,
  GUEST_LIST_SQL,
  GUEST_PREFERENCES_LIST_SQL,
  GUEST_RESERVATION_STATS_SQL,
} from "../sql/guest-queries.js";
import { toNonNegativeInt, toNumberOrFallback } from "../utils/numbers.js";
import { normalizePhoneNumber } from "../utils/phone.js";

const DEFAULT_ADDRESS = {
  street: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

const DEFAULT_PREFERENCES = {
  smoking: false,
  language: "en",
  dietaryRestrictions: [] as string[],
  specialRequests: [] as string[],
};

const DEFAULT_COMMUNICATION_PREFERENCES = {
  email: true,
  sms: false,
  phone: true,
  post: false,
};

const GUEST_BED_TYPES = new Set(["KING", "QUEEN", "TWIN", "DOUBLE"]);

const normalizeAddress = (address: Record<string, unknown> | null | undefined) => ({
  street: typeof address?.street === "string" ? address.street : DEFAULT_ADDRESS.street,
  city: typeof address?.city === "string" ? address.city : DEFAULT_ADDRESS.city,
  state: typeof address?.state === "string" ? address.state : DEFAULT_ADDRESS.state,
  postalCode:
    typeof address?.postalCode === "string" ? address.postalCode : DEFAULT_ADDRESS.postalCode,
  country: typeof address?.country === "string" ? address.country : DEFAULT_ADDRESS.country,
});

const normalizePreferences = (preferences: Record<string, unknown> | null | undefined) => {
  const normalized = {
    ...DEFAULT_PREFERENCES,
  } as Record<string, unknown>;

  const maybeString = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim().length > 0 ? value : undefined;

  const maybeBoolean = (value: unknown, fallback: boolean) =>
    typeof value === "boolean" ? value : fallback;

  normalized.smoking = maybeBoolean(preferences?.smoking, DEFAULT_PREFERENCES.smoking);

  const language = maybeString(preferences?.language);
  normalized.language = language && language.length === 2 ? language : DEFAULT_PREFERENCES.language;

  const rawDietary = (preferences as { dietaryRestrictions?: unknown })?.dietaryRestrictions;
  const dietary = Array.isArray(rawDietary)
    ? rawDietary.filter((item): item is string => typeof item === "string")
    : DEFAULT_PREFERENCES.dietaryRestrictions;
  normalized.dietaryRestrictions = dietary;

  const rawSpecial = (preferences as { specialRequests?: unknown })?.specialRequests;
  const special = Array.isArray(rawSpecial)
    ? rawSpecial.filter((item): item is string => typeof item === "string")
    : DEFAULT_PREFERENCES.specialRequests;
  normalized.specialRequests = special;

  const roomType = maybeString(preferences?.roomType);
  if (roomType) {
    normalized.roomType = roomType;
  }

  const floor = maybeString(preferences?.floor);
  if (floor) {
    normalized.floor = floor;
  }

  const bedType = maybeString(preferences?.bedType);
  if (bedType && GUEST_BED_TYPES.has(bedType)) {
    normalized.bedType = bedType;
  }

  return normalized;
};

const normalizeCommunicationPreferences = (
  preferences: Record<string, unknown> | null | undefined,
) => ({
  email:
    typeof preferences?.email === "boolean"
      ? preferences.email
      : DEFAULT_COMMUNICATION_PREFERENCES.email,
  sms:
    typeof preferences?.sms === "boolean" ? preferences.sms : DEFAULT_COMMUNICATION_PREFERENCES.sms,
  phone:
    typeof preferences?.phone === "boolean"
      ? preferences.phone
      : DEFAULT_COMMUNICATION_PREFERENCES.phone,
  post:
    typeof preferences?.post === "boolean"
      ? preferences.post
      : DEFAULT_COMMUNICATION_PREFERENCES.post,
});

type GuestRow = {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  title: string | null;
  date_of_birth: Date | null;
  gender: string | null;
  nationality: string | null;
  email: string;
  phone: string | null;
  secondary_phone: string | null;
  address: Record<string, unknown> | null;
  id_type: string | null;
  id_number: string | null;
  passport_number: string | null;
  passport_expiry: Date | null;
  company_name: string | null;
  company_tax_id: string | null;
  loyalty_tier: string | null;
  loyalty_points: number | null;
  vip_status: boolean | null;
  preferences: Record<string, unknown> | null;
  marketing_consent: boolean | null;
  communication_preferences: Record<string, unknown> | null;
  total_bookings: number | null;
  total_nights: number | null;
  total_revenue: string | number | null;
  last_stay_date: Date | null;
  is_blacklisted: boolean | null;
  blacklist_reason: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: Date | null;
  version: bigint | null;
};

type GuestReservationStats = {
  upcomingReservations: number;
  pastReservations: number;
  cancelledReservations: number;
  averageStayLength?: number;
  preferredRoomTypes?: string[];
  lifetimeValue?: number;
};

const mapRowToGuest = (row: GuestRow, stats?: GuestReservationStats): GuestWithStats => {
  const parsed = GuestWithStatsSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    first_name: row.first_name,
    last_name: row.last_name,
    middle_name: row.middle_name ?? undefined,
    title: row.title ?? undefined,
    date_of_birth: row.date_of_birth ?? undefined,
    gender: row.gender ?? undefined,
    nationality: row.nationality ?? undefined,
    email: row.email,
    phone: normalizePhoneNumber(row.phone),
    secondary_phone: normalizePhoneNumber(row.secondary_phone),
    address: normalizeAddress(row.address),
    id_type: row.id_type ?? undefined,
    id_number: row.id_number ?? undefined,
    passport_number: row.passport_number ?? undefined,
    passport_expiry: row.passport_expiry ?? undefined,
    company_name: row.company_name ?? undefined,
    company_tax_id: row.company_tax_id ?? undefined,
    loyalty_tier: row.loyalty_tier ?? undefined,
    loyalty_points: row.loyalty_points ?? 0,
    vip_status: row.vip_status ?? false,
    preferences: normalizePreferences(row.preferences),
    marketing_consent: row.marketing_consent ?? false,
    communication_preferences: normalizeCommunicationPreferences(row.communication_preferences),
    total_bookings: row.total_bookings ?? 0,
    total_nights: row.total_nights ?? 0,
    total_revenue: toNumberOrFallback(row.total_revenue),
    last_stay_date: row.last_stay_date ?? undefined,
    is_blacklisted: row.is_blacklisted ?? false,
    blacklist_reason: row.blacklist_reason ?? undefined,
    notes: row.notes ?? undefined,
    metadata: row.metadata ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
    created_by: row.created_by ?? undefined,
    updated_by: row.updated_by ?? undefined,
    deleted_at: row.deleted_at ?? null,
    version: row.version ?? BigInt(0),
    upcoming_reservations: stats?.upcomingReservations ?? 0,
    past_reservations: stats?.pastReservations ?? 0,
    cancelled_reservations: stats?.cancelledReservations ?? 0,
    average_stay_length: stats?.averageStayLength ?? undefined,
    preferred_room_types: stats?.preferredRoomTypes ?? undefined,
    lifetime_value: stats?.lifetimeValue ?? toNumberOrFallback(row.total_revenue),
  });

  return parsed;
};

const fetchGuestReservationStats = async (
  tenantId: string,
  guestIds: string[],
  propertyId?: string,
): Promise<Map<string, GuestReservationStats>> => {
  if (guestIds.length === 0) {
    return new Map();
  }

  const { rows } = await query<{
    guest_id: string;
    upcoming_reservations: string | number | null;
    past_reservations: string | number | null;
    cancelled_reservations: string | number | null;
    average_stay_length: string | number | null;
    lifetime_value: string | number | null;
    preferred_room_types: string[] | null;
  }>(GUEST_RESERVATION_STATS_SQL, [tenantId, guestIds, propertyId ?? null]);

  return rows.reduce<Map<string, GuestReservationStats>>((acc, row) => {
    acc.set(row.guest_id, {
      upcomingReservations: toNonNegativeInt(row.upcoming_reservations, 0),
      pastReservations: toNonNegativeInt(row.past_reservations, 0),
      cancelledReservations: toNonNegativeInt(row.cancelled_reservations, 0),
      averageStayLength:
        typeof row.average_stay_length === "number"
          ? Number(row.average_stay_length)
          : row.average_stay_length
            ? Number.parseFloat(row.average_stay_length)
            : undefined,
      lifetimeValue: toNumberOrFallback(row.lifetime_value),
      preferredRoomTypes: row.preferred_room_types ?? undefined,
    });
    return acc;
  }, new Map());
};

/**
 * List guests with optional filters and computed reservation stats.
 */
export const listGuests = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  email?: string;
  phone?: string;
  loyaltyTier?: string;
  vipStatus?: boolean;
  isBlacklisted?: boolean;
}): Promise<GuestWithStats[]> => {
  const limit = options.limit ?? 50;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const email = options.email ? `%${options.email}%` : null;
  const phone = options.phone ? `%${options.phone}%` : null;
  const loyaltyTier = options.loyaltyTier ?? null;
  const vipStatus = options.vipStatus ?? null;
  const isBlacklisted = options.isBlacklisted ?? null;

  const { rows } = await query<GuestRow>(GUEST_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    email,
    phone,
    loyaltyTier,
    vipStatus,
    isBlacklisted,
  ]);

  if (rows.length === 0) {
    return [];
  }

  const guestIds = rows.map((row) => row.id);
  const statsMap = await fetchGuestReservationStats(tenantId, guestIds, propertyId ?? undefined);

  return rows.map((row) => applyGuestRetentionPolicy(mapRowToGuest(row, statsMap.get(row.id))));
};

// ============================================================================
// GUEST PREFERENCES
// ============================================================================

const formatEnumDisplay = (
  value: string | null,
  fallback: string,
): { value: string; display: string } => {
  if (!value || typeof value !== "string") {
    const formatted = fallback.toLowerCase();
    return { value: formatted, display: fallback };
  }
  const normalized = value.toLowerCase();
  const display = normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return { value: normalized, display };
};

const toIsoString = (value: string | Date | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

type GuestPreferenceRow = {
  id: string;
  tenant_id: string;
  property_id: string | null;
  guest_id: string;
  preference_category: string;
  preference_type: string;
  preference_value: string | null;
  preference_code: string | null;
  priority: number;
  is_mandatory: boolean;
  is_special_request: boolean;
  preferred_floor: number | null;
  floor_preference: string | null;
  bed_type_preference: string | null;
  smoking_preference: string | null;
  view_preference: string | null;
  room_location_preference: string | null;
  turndown_service: boolean | null;
  do_not_disturb_default: boolean | null;
  dietary_restrictions: string[] | null;
  food_allergies: string[] | null;
  mobility_accessible: boolean | null;
  hearing_accessible: boolean | null;
  visual_accessible: boolean | null;
  service_animal: boolean | null;
  accessibility_notes: string | null;
  preferred_language: string | null;
  preferred_contact_method: string | null;
  marketing_opt_in: boolean | null;
  is_active: boolean;
  source: string | null;
  times_honored: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date | null;
};

const mapRowToPreference = (row: GuestPreferenceRow): GuestPreferenceListItem => {
  const { value: category, display: categoryDisplay } = formatEnumDisplay(
    row.preference_category,
    "Other",
  );

  return GuestPreferenceListItemSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id ?? undefined,
    guest_id: row.guest_id,
    preference_category: category,
    preference_category_display: categoryDisplay,
    preference_type: row.preference_type,
    preference_value: row.preference_value ?? undefined,
    preference_code: row.preference_code ?? undefined,
    priority: row.priority,
    is_mandatory: row.is_mandatory,
    is_special_request: row.is_special_request,
    preferred_floor: row.preferred_floor ?? undefined,
    floor_preference: row.floor_preference ?? undefined,
    bed_type_preference: row.bed_type_preference ?? undefined,
    smoking_preference: row.smoking_preference ?? undefined,
    view_preference: row.view_preference ?? undefined,
    room_location_preference: row.room_location_preference ?? undefined,
    turndown_service: row.turndown_service ?? undefined,
    do_not_disturb_default: row.do_not_disturb_default ?? undefined,
    dietary_restrictions: row.dietary_restrictions ?? undefined,
    food_allergies: row.food_allergies ?? undefined,
    mobility_accessible: row.mobility_accessible ?? undefined,
    hearing_accessible: row.hearing_accessible ?? undefined,
    visual_accessible: row.visual_accessible ?? undefined,
    service_animal: row.service_animal ?? undefined,
    accessibility_notes: row.accessibility_notes ?? undefined,
    preferred_language: row.preferred_language ?? undefined,
    preferred_contact_method: row.preferred_contact_method ?? undefined,
    marketing_opt_in: row.marketing_opt_in ?? undefined,
    is_active: row.is_active,
    source: row.source ?? undefined,
    times_honored: row.times_honored ?? undefined,
    notes: row.notes ?? undefined,
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at),
  });
};

/**
 * List guest preferences with optional filters.
 */
export const listGuestPreferences = async (options: {
  limit?: number;
  tenantId: string;
  guestId: string;
  category?: string;
  activeOnly?: boolean;
}): Promise<GuestPreferenceListItem[]> => {
  const limit = options.limit ?? 100;
  const tenantId = options.tenantId;
  const guestId = options.guestId;
  const category = options.category ?? null;
  const activeOnly = options.activeOnly ?? null;

  const { rows } = await query<GuestPreferenceRow>(GUEST_PREFERENCES_LIST_SQL, [
    limit,
    tenantId,
    guestId,
    category,
    activeOnly,
  ]);

  return rows.map(mapRowToPreference);
};

// ============================================================================
// GUEST DOCUMENTS
// ============================================================================

type GuestDocumentRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  guest_id: string;
  reservation_id: string | null;
  document_type: string;
  document_category: string | null;
  document_number: string | null;
  document_name: string;
  description: string | null;
  file_name: string;
  file_size_bytes: number | null;
  file_type: string | null;
  mime_type: string | null;
  issue_date: Date | null;
  expiry_date: Date | null;
  issuing_country: string | null;
  is_verified: boolean;
  verification_status: string;
  verified_at: Date | null;
  uploaded_at: Date;
  upload_source: string | null;
  is_expired: boolean;
  days_until_expiry: number | null;
  created_at: Date;
};

const mapRowToDocument = (row: GuestDocumentRow): GuestDocumentListItem => {
  const { value: docType, display: docTypeDisplay } = formatEnumDisplay(row.document_type, "Other");
  const { value: verStatus, display: verStatusDisplay } = formatEnumDisplay(
    row.verification_status,
    "Pending",
  );

  return GuestDocumentListItemSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    guest_id: row.guest_id,
    reservation_id: row.reservation_id ?? undefined,
    document_type: docType,
    document_type_display: docTypeDisplay,
    document_category: row.document_category ?? undefined,
    document_number: row.document_number ?? undefined,
    document_name: row.document_name,
    description: row.description ?? undefined,
    file_name: row.file_name,
    file_size_bytes: row.file_size_bytes ?? undefined,
    file_type: row.file_type ?? undefined,
    mime_type: row.mime_type ?? undefined,
    issue_date: toIsoString(row.issue_date),
    expiry_date: toIsoString(row.expiry_date),
    issuing_country: row.issuing_country ?? undefined,
    is_verified: row.is_verified,
    verification_status: verStatus,
    verification_status_display: verStatusDisplay,
    verified_at: toIsoString(row.verified_at),
    uploaded_at: toIsoString(row.uploaded_at) ?? "",
    upload_source: row.upload_source ?? undefined,
    is_expired: row.is_expired,
    days_until_expiry: row.days_until_expiry ?? undefined,
    created_at: toIsoString(row.created_at) ?? "",
  });
};

/**
 * List guest documents with optional filters.
 */
export const listGuestDocuments = async (options: {
  limit?: number;
  tenantId: string;
  guestId: string;
  documentType?: string;
  verificationStatus?: string;
}): Promise<GuestDocumentListItem[]> => {
  const limit = options.limit ?? 100;
  const tenantId = options.tenantId;
  const guestId = options.guestId;
  const documentType = options.documentType ?? null;
  const verificationStatus = options.verificationStatus ?? null;

  const { rows } = await query<GuestDocumentRow>(GUEST_DOCUMENTS_LIST_SQL, [
    limit,
    tenantId,
    guestId,
    documentType,
    verificationStatus,
  ]);

  return rows.map(mapRowToDocument);
};

// ============================================================================
// GUEST COMMUNICATIONS
// ============================================================================

type GuestCommunicationRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  guest_id: string;
  reservation_id: string | null;
  communication_type: string;
  direction: string;
  subject: string | null;
  message: string;
  sender_name: string | null;
  sender_email: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  status: string;
  sent_at: Date | null;
  delivered_at: Date | null;
  opened_at: Date | null;
  failed_at: Date | null;
  failure_reason: string | null;
  created_at: Date;
};

const mapRowToCommunication = (row: GuestCommunicationRow): GuestCommunicationListItem => {
  const { value: commType, display: commTypeDisplay } = formatEnumDisplay(
    row.communication_type,
    "Email",
  );
  const { value: direction, display: directionDisplay } = formatEnumDisplay(
    row.direction,
    "Outbound",
  );
  const { value: status, display: statusDisplay } = formatEnumDisplay(row.status, "Sent");

  return GuestCommunicationListItemSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    guest_id: row.guest_id,
    reservation_id: row.reservation_id ?? undefined,
    communication_type: commType,
    communication_type_display: commTypeDisplay,
    direction,
    direction_display: directionDisplay,
    subject: row.subject ?? undefined,
    message: row.message,
    sender_name: row.sender_name ?? undefined,
    sender_email: row.sender_email ?? undefined,
    recipient_name: row.recipient_name ?? undefined,
    recipient_email: row.recipient_email ?? undefined,
    status,
    status_display: statusDisplay,
    sent_at: toIsoString(row.sent_at),
    delivered_at: toIsoString(row.delivered_at),
    opened_at: toIsoString(row.opened_at),
    failed_at: toIsoString(row.failed_at),
    failure_reason: row.failure_reason ?? undefined,
    created_at: toIsoString(row.created_at) ?? "",
  });
};

/**
 * List guest communications with optional filters.
 */
export const listGuestCommunications = async (options: {
  limit?: number;
  tenantId: string;
  guestId: string;
  communicationType?: string;
  direction?: string;
  status?: string;
}): Promise<GuestCommunicationListItem[]> => {
  const limit = options.limit ?? 100;
  const tenantId = options.tenantId;
  const guestId = options.guestId;
  const communicationType = options.communicationType ?? null;
  const direction = options.direction ?? null;
  const status = options.status ?? null;

  const { rows } = await query<GuestCommunicationRow>(GUEST_COMMUNICATIONS_LIST_SQL, [
    limit,
    tenantId,
    guestId,
    communicationType,
    direction,
    status,
  ]);

  return rows.map(mapRowToCommunication);
};
