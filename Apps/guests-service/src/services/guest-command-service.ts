import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import {
  GuestGdprEraseCommandSchema,
  type GuestMergeCommand,
  GuestMergeCommandSchema,
  GuestPreferenceUpdateCommandSchema,
  type GuestRegisterCommand,
  GuestSetBlacklistCommandSchema,
  GuestSetLoyaltyCommandSchema,
  GuestSetVipCommandSchema,
  GuestUpdateContactCommandSchema,
  GuestUpdateProfileCommandSchema,
} from "../schemas/guest-commands.js";
import { normalizePhoneNumber } from "../utils/phone.js";

const guestCommandLogger = appLogger.child({
  module: "guest-command-service",
});

const APP_ACTOR = "COMMAND_CENTER";

type GuestAddress = {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
};

const normalizeAddress = (
  address?: GuestAddress | null,
): Record<string, unknown> | null => {
  if (!address) {
    return null;
  }
  return {
    street: address.street ?? null,
    city: address.city ?? null,
    state: address.state ?? null,
    country: address.country ?? null,
    postalCode: address.postal_code ?? null,
  };
};

const appendMetadata = (
  base: Record<string, unknown> | null | undefined,
  extra: Record<string, unknown>,
): Record<string, unknown> => ({
  ...(base ?? {}),
  ...extra,
});

type RegisterGuestOptions = {
  tenantId: string;
  payload: GuestRegisterCommand;
  correlationId?: string;
  initiatedBy?: {
    userId?: string;
    role?: string;
  } | null;
};

export const registerGuestProfile = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: RegisterGuestOptions): Promise<string | undefined> => {
  const normalizedPhone = normalizePhoneNumber(payload.phone ?? undefined);
  const address = payload.address ?? {};
  const preferences =
    payload.preferences !== undefined
      ? JSON.stringify(payload.preferences)
      : null;

  const createdBy = initiatedBy?.userId ?? "COMMAND_CENTER";

  const result = await query<{ guest_id: string }>(
    `
      SELECT upsert_guest(
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11::jsonb,
        $12
      ) AS guest_id
    `,
    [
      tenantId,
      payload.email,
      payload.first_name,
      payload.last_name,
      normalizedPhone ?? null,
      address?.street ?? null,
      address?.city ?? null,
      address?.state ?? null,
      address?.country ?? null,
      address?.postal_code ?? null,
      preferences,
      createdBy,
    ],
  );

  const guestId = result.rows[0]?.guest_id;
  guestCommandLogger.info(
    {
      tenantId,
      guestId,
      correlationId,
      initiatedBy,
    },
    "guest.register command applied",
  );
  return guestId;
};

type MergeGuestOptions = {
  tenantId: string;
  payload: unknown;
  correlationId?: string;
  initiatedBy?: {
    userId?: string;
    role?: string;
  } | null;
};

type GuestRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  secondary_phone: string | null;
  address: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  total_bookings: number | null;
  total_nights: number | null;
  total_revenue: number | string | null;
  last_stay_date: string | Date | null;
  loyalty_points: number | null;
  loyalty_tier: string | null;
  vip_status: boolean | null;
  is_blacklisted: boolean | null;
};

type GuestMergeResult = {
  primaryGuestId: string;
};

export const mergeGuestProfiles = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: MergeGuestOptions): Promise<GuestMergeResult> => {
  const command = GuestMergeCommandSchema.parse(payload);
  const actor = initiatedBy?.userId ?? "COMMAND_CENTER";
  const guests = await query<GuestRow>(
    `
      SELECT
        id,
        first_name,
        last_name,
        email,
        phone,
        secondary_phone,
        address,
        preferences,
        notes,
        metadata,
        total_bookings,
        total_nights,
        total_revenue,
        last_stay_date,
        loyalty_points,
        loyalty_tier,
        vip_status,
        is_blacklisted
      FROM public.guests
      WHERE tenant_id = $1::uuid
        AND id IN ($2::uuid, $3::uuid)
        AND COALESCE(is_deleted, false) = false
    `,
    [tenantId, command.primary_guest_id, command.duplicate_guest_id],
  );

  const primary = guests.rows.find(
    (guest) => guest.id === command.primary_guest_id,
  );
  const duplicate = guests.rows.find(
    (guest) => guest.id === command.duplicate_guest_id,
  );

  if (!primary || !duplicate) {
    throw new Error("GUEST_MERGE_TARGETS_NOT_FOUND");
  }

  const merged = mergeGuestRows(primary, duplicate, command);

  await query(
    `
      UPDATE public.guests
      SET
        phone = $3,
        secondary_phone = $4,
        address = $5::jsonb,
        preferences = $6::jsonb,
        notes = $7,
        metadata = $8::jsonb,
        total_bookings = $9,
        total_nights = $10,
        total_revenue = $11,
        last_stay_date = $12,
        loyalty_points = $13,
        loyalty_tier = $14,
        vip_status = $15,
        is_blacklisted = $16,
        updated_at = NOW(),
        updated_by = $17
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
    `,
    [
      tenantId,
      primary.id,
      merged.phone,
      merged.secondary_phone,
      JSON.stringify(merged.address),
      JSON.stringify(merged.preferences),
      merged.notes,
      JSON.stringify(merged.metadata),
      merged.total_bookings,
      merged.total_nights,
      merged.total_revenue,
      merged.last_stay_date,
      merged.loyalty_points,
      merged.loyalty_tier,
      merged.vip_status,
      merged.is_blacklisted,
      actor,
    ],
  );

  await query(
    `
      UPDATE public.guests
      SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = $4,
        metadata = metadata || jsonb_build_object('merged_into', $2, 'merged_at', NOW())
      WHERE tenant_id = $1::uuid
        AND id = $3::uuid
    `,
    [tenantId, primary.id, duplicate.id, actor],
  );

  guestCommandLogger.info(
    {
      tenantId,
      primaryGuestId: primary.id,
      duplicateGuestId: duplicate.id,
      correlationId,
      initiatedBy,
    },
    "guest.merge command applied",
  );

  return { primaryGuestId: primary.id };
};

type GuestUpdateOptions = {
  tenantId: string;
  payload: unknown;
  correlationId?: string;
  initiatedBy?: {
    userId?: string;
    role?: string;
  } | null;
};

export const updateGuestProfile = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestUpdateProfileCommandSchema.parse(payload);
  const actor = initiatedBy?.userId ?? APP_ACTOR;
  const normalizedPhone = normalizePhoneNumber(command.phone ?? undefined);
  const address = normalizeAddress(command.address ?? null);
  const preferences =
    command.preferences !== undefined ? command.preferences : null;
  const marketingConsent = command.preferences?.marketing_consent ?? undefined;

  const { rowCount } = await query(
    `
      UPDATE public.guests
      SET
        first_name = COALESCE($3, first_name),
        last_name = COALESCE($4, last_name),
        email = COALESCE($5, email),
        phone = COALESCE($6, phone),
        address = CASE
          WHEN $7::jsonb IS NULL THEN address
          ELSE COALESCE(address, '{}'::jsonb) || $7::jsonb
        END,
        preferences = CASE
          WHEN $8::jsonb IS NULL THEN preferences
          ELSE COALESCE(preferences, '{}'::jsonb) || $8::jsonb
        END,
        marketing_consent = COALESCE($9, marketing_consent),
        updated_at = NOW(),
        updated_by = $10
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      tenantId,
      command.guest_id,
      command.first_name ?? null,
      command.last_name ?? null,
      command.email ?? null,
      normalizedPhone ?? null,
      address ? JSON.stringify(address) : null,
      preferences ? JSON.stringify(preferences) : null,
      marketingConsent ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new Error("GUEST_NOT_FOUND");
  }

  guestCommandLogger.info(
    { tenantId, guestId: command.guest_id, correlationId, initiatedBy },
    "guest.update_profile command applied",
  );
};

export const updateGuestContact = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestUpdateContactCommandSchema.parse(payload);
  const actor = initiatedBy?.userId ?? APP_ACTOR;
  const normalizedPhone = normalizePhoneNumber(command.phone ?? undefined);
  const address = normalizeAddress(command.address ?? null);

  const { rowCount } = await query(
    `
      UPDATE public.guests
      SET
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        address = CASE
          WHEN $5::jsonb IS NULL THEN address
          ELSE COALESCE(address, '{}'::jsonb) || $5::jsonb
        END,
        updated_at = NOW(),
        updated_by = $6
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      tenantId,
      command.guest_id,
      command.email ?? null,
      normalizedPhone ?? null,
      address ? JSON.stringify(address) : null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new Error("GUEST_NOT_FOUND");
  }

  guestCommandLogger.info(
    { tenantId, guestId: command.guest_id, correlationId, initiatedBy },
    "guest.update_contact command applied",
  );
};

export const setGuestLoyalty = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestSetLoyaltyCommandSchema.parse(payload);
  const actor = initiatedBy?.userId ?? APP_ACTOR;

  const { rowCount } = await query(
    `
      UPDATE public.guests
      SET
        loyalty_tier = COALESCE($3, loyalty_tier),
        loyalty_points = CASE
          WHEN $4::numeric IS NULL THEN loyalty_points
          ELSE GREATEST(0, COALESCE(loyalty_points, 0) + $4::numeric)
        END,
        notes = CASE
          WHEN $5 IS NULL THEN notes
          WHEN notes IS NULL THEN $5
          ELSE CONCAT_WS(E'\\n', notes, $5)
        END,
        updated_at = NOW(),
        updated_by = $6
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      tenantId,
      command.guest_id,
      command.loyalty_tier ?? null,
      typeof command.points_delta === "number" ? command.points_delta : null,
      command.reason ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new Error("GUEST_NOT_FOUND");
  }

  guestCommandLogger.info(
    { tenantId, guestId: command.guest_id, correlationId, initiatedBy },
    "guest.set_loyalty command applied",
  );
};

export const setGuestVip = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestSetVipCommandSchema.parse(payload);
  const actor = initiatedBy?.userId ?? APP_ACTOR;

  const { rowCount } = await query(
    `
      UPDATE public.guests
      SET
        vip_status = $3,
        notes = CASE
          WHEN $4 IS NULL THEN notes
          WHEN notes IS NULL THEN $4
          ELSE CONCAT_WS(E'\\n', notes, $4)
        END,
        updated_at = NOW(),
        updated_by = $5
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      tenantId,
      command.guest_id,
      command.vip_status,
      command.reason ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new Error("GUEST_NOT_FOUND");
  }

  guestCommandLogger.info(
    { tenantId, guestId: command.guest_id, correlationId, initiatedBy },
    "guest.set_vip command applied",
  );
};

export const setGuestBlacklist = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestSetBlacklistCommandSchema.parse(payload);
  const actor = initiatedBy?.userId ?? APP_ACTOR;

  const { rowCount } = await query(
    `
      UPDATE public.guests
      SET
        is_blacklisted = $3,
        blacklist_reason = COALESCE($4, blacklist_reason),
        updated_at = NOW(),
        updated_by = $5
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      tenantId,
      command.guest_id,
      command.is_blacklisted,
      command.reason ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new Error("GUEST_NOT_FOUND");
  }

  guestCommandLogger.info(
    { tenantId, guestId: command.guest_id, correlationId, initiatedBy },
    "guest.set_blacklist command applied",
  );
};

export const eraseGuestForGdpr = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestGdprEraseCommandSchema.parse(payload);
  const actor = initiatedBy?.userId ?? APP_ACTOR;
  const redactedEmail = `gdpr+${command.guest_id}@redacted.invalid`;

  // Check if guest is already deleted for idempotency
  const existingGuest = await query(
    `SELECT id, is_deleted FROM public.guests WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [tenantId, command.guest_id],
  );

  if (!existingGuest.rowCount || existingGuest.rowCount === 0) {
    throw new Error("GUEST_NOT_FOUND");
  }

  // Idempotent: if already deleted, log and return success
  if (existingGuest.rows[0]?.is_deleted) {
    guestCommandLogger.info(
      { tenantId, guestId: command.guest_id, correlationId, initiatedBy },
      "guest.gdpr.erase already applied (idempotent)",
    );
    return;
  }

  const { rowCount } = await query(
    `
      UPDATE public.guests
      SET
        first_name = 'Deleted',
        last_name = 'Guest',
        email = $3,
        phone = NULL,
        secondary_phone = NULL,
        address = '{}'::jsonb,
        preferences = '{}'::jsonb,
        marketing_consent = false,
        notes = NULL,
        metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
        is_deleted = true,
        deleted_at = NOW(),
        deleted_by = $5,
        updated_at = NOW(),
        updated_by = $5
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      tenantId,
      command.guest_id,
      redactedEmail,
      JSON.stringify(
        appendMetadata(command.metadata ?? null, {
          gdpr_erased_at: new Date().toISOString(),
          gdpr_reason: command.reason ?? null,
        }),
      ),
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new Error("GUEST_NOT_FOUND");
  }

  guestCommandLogger.info(
    { tenantId, guestId: command.guest_id, correlationId, initiatedBy },
    "guest.gdpr.erase command applied",
  );
};

export const updateGuestPreferences = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestPreferenceUpdateCommandSchema.parse(payload);
  const actor = initiatedBy?.userId ?? APP_ACTOR;
  const marketingConsent = command.preferences?.marketing_consent ?? undefined;

  const { rowCount } = await query(
    `
      UPDATE public.guests
      SET
        preferences = COALESCE(preferences, '{}'::jsonb) || $3::jsonb,
        marketing_consent = COALESCE($4, marketing_consent),
        updated_at = NOW(),
        updated_by = $5
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `,
    [
      tenantId,
      command.guest_id,
      JSON.stringify(command.preferences ?? {}),
      marketingConsent ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new Error("GUEST_NOT_FOUND");
  }

  guestCommandLogger.info(
    { tenantId, guestId: command.guest_id, correlationId, initiatedBy },
    "guest.preference.update command applied",
  );
};

const mergeGuestRows = (
  primary: GuestRow,
  duplicate: GuestRow,
  payload: GuestMergeCommand,
) => {
  const mergedMetadata = {
    ...(duplicate.metadata ?? {}),
    ...(primary.metadata ?? {}),
    mergedFrom: [
      ...(Array.isArray(primary.metadata?.mergedFrom)
        ? (primary.metadata?.mergedFrom as unknown[])
        : []),
      duplicate.id,
    ],
    ...(payload.metadata ?? {}),
  };

  const mergedNotes = [primary.notes, payload.notes, duplicate.notes]
    .filter((note) => Boolean(note && note.trim().length > 0))
    .join("\n---\n");

  const mergedAddress = mergeRecord(
    duplicate.address ?? {},
    primary.address ?? {},
  );

  const mergedPreferences = mergeRecord(
    duplicate.preferences ?? {},
    primary.preferences ?? {},
  );

  return {
    phone: primary.phone ?? duplicate.phone ?? null,
    secondary_phone:
      primary.secondary_phone ?? duplicate.secondary_phone ?? null,
    address: mergedAddress,
    preferences: mergedPreferences,
    notes: mergedNotes || null,
    metadata: mergedMetadata,
    total_bookings:
      Number(primary.total_bookings ?? 0) +
      Number(duplicate.total_bookings ?? 0),
    total_nights:
      Number(primary.total_nights ?? 0) + Number(duplicate.total_nights ?? 0),
    total_revenue:
      Number(primary.total_revenue ?? 0) + Number(duplicate.total_revenue ?? 0),
    last_stay_date: pickLatestDate(
      primary.last_stay_date,
      duplicate.last_stay_date,
    ),
    loyalty_points:
      Number(primary.loyalty_points ?? 0) +
      Number(duplicate.loyalty_points ?? 0),
    loyalty_tier: primary.loyalty_tier ?? duplicate.loyalty_tier ?? null,
    vip_status: Boolean(primary.vip_status || duplicate.vip_status),
    is_blacklisted: Boolean(primary.is_blacklisted || duplicate.is_blacklisted),
  };
};

const mergeRecord = (
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> => {
  return { ...base, ...overrides };
};

const pickLatestDate = (
  first: string | Date | null,
  second: string | Date | null,
): Date | null => {
  const firstDate = first ? new Date(first) : null;
  const secondDate = second ? new Date(second) : null;

  if (firstDate && secondDate) {
    return firstDate > secondDate ? firstDate : secondDate;
  }
  return firstDate ?? secondDate ?? null;
};
