import { type GuestWithStats, GuestWithStatsSchema } from "@tartware/schemas";

import { query } from "../lib/db.js";
import { toNumberOrFallback } from "../utils/numbers.js";
import { normalizePhoneNumber } from "../utils/phone.js";
import { GUEST_LIST_SQL } from "../sql/guest-queries.js";

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

const GUEST_BED_TYPES = new Set(["KING", "QUEEN", "TWIN", "DOUBLE"]);

const DEFAULT_COMMUNICATION_PREFERENCES = {
  email: true,
  sms: false,
  phone: true,
  post: false,
};

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

const mapRowToGuest = (row: GuestRow): GuestWithStats => {
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
    upcoming_reservations: undefined,
    past_reservations: undefined,
    cancelled_reservations: undefined,
    average_stay_length: undefined,
    preferred_room_types: undefined,
    lifetime_value: toNumberOrFallback(row.total_revenue),
  });

  return parsed;
};

export const listGuests = async (
  options: {
    limit?: number;
    tenantId?: string;
    email?: string;
    phone?: string;
    loyaltyTier?: string;
    vipStatus?: boolean;
    isBlacklisted?: boolean;
  } = {},
): Promise<GuestWithStats[]> => {
  const limit = options.limit ?? 50;
  const tenantId = options.tenantId ?? null;
  const email = options.email ? `%${options.email}%` : null;
  const phone = options.phone ? `%${options.phone}%` : null;
  const loyaltyTier = options.loyaltyTier ?? null;
  const vipStatus = options.vipStatus ?? null;
  const isBlacklisted = options.isBlacklisted ?? null;

  const { rows } = await query<GuestRow>(GUEST_LIST_SQL, [
    limit,
    tenantId,
    email,
    phone,
    loyaltyTier,
    vipStatus,
    isBlacklisted,
  ]);

  return rows.map(mapRowToGuest);
};
