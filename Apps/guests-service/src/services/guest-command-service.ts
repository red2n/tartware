import { CommandError, resolveActorId } from "@tartware/command-consumer-utils/command-utils";
import type {
  GuestAddress,
  GuestCommandRow,
  GuestMergeResult,
  GuestUpdateOptions,
  MergeGuestOptions,
  RegisterGuestOptions,
} from "@tartware/schemas";
import { queryWithClient, withTransaction } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import {
  adjustLoyalty,
  applyGuestContactUpdate,
  applyGuestProfileUpdate,
  applyMergedGuestFields,
  findGuestDeletionState,
  findLoyaltyPoints,
  findMergePair,
  mergeGuestPreferences,
  retireMergedDuplicate,
  setBlacklistStatus,
  setVipStatus,
  upsertGuest,
} from "../repositories/guest-command-repository.js";
import {
  GuestConsentUpdateCommandSchema,
  GuestGdprEraseCommandSchema,
  type GuestMergeCommand,
  GuestMergeCommandSchema,
  GuestPreferenceUpdateCommandSchema,
  GuestSetBlacklistCommandSchema,
  GuestSetLoyaltyCommandSchema,
  GuestSetVipCommandSchema,
  GuestUpdateContactCommandSchema,
  GuestUpdateProfileCommandSchema,
} from "../schemas/guest-commands.js";
import { hashIdentifier, recordAuditLog, redactPayload } from "../utils/audit.js";
import { normalizePhoneNumber } from "../utils/phone.js";
import { updateGuestConsent } from "./privacy-service.js";

const guestCommandLogger = appLogger.child({
  module: "guest-command-service",
});

// GuestAddress imported from @tartware/schemas

const normalizeAddress = (address?: GuestAddress | null): Record<string, unknown> | null => {
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

// RegisterGuestOptions imported from @tartware/schemas

/**
 * Register or update a guest profile (idempotent upsert).
 */
export const registerGuestProfile = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: RegisterGuestOptions): Promise<string | undefined> => {
  const normalizedPhone = normalizePhoneNumber(payload.phone ?? undefined);
  const address = payload.address ?? {};
  const vipStatus = payload.preferences?.vip_status ?? "NONE";
  const preferences =
    payload.preferences !== undefined ? JSON.stringify(payload.preferences) : null;

  const createdBy = resolveActorId(initiatedBy);

  const result = await upsertGuest([
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
    vipStatus,
    payload.title ?? null,
    payload.nationality ?? null,
    payload.gender ?? null,
    payload.date_of_birth ?? null,
    payload.loyalty_tier ?? null,
  ]);

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

  await recordAuditLog({
    tenantId,
    propertyId: null,
    actorId: createdBy,
    action: "guest.register",
    eventType: "CREATE",
    entityType: "guest",
    entityId: guestId ?? null,
    metadata: {
      guest_id: hashIdentifier(guestId || ""),
      correlationId,
      redacted_payload: redactPayload(payload),
    },
  });

  return guestId;
};

// MergeGuestOptions imported from @tartware/schemas

type GuestRow = GuestCommandRow;

// GuestMergeResult imported from @tartware/schemas

/**
 * Merge two guest profiles into a primary profile.
 */
export const mergeGuestProfiles = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: MergeGuestOptions): Promise<GuestMergeResult> => {
  const command = GuestMergeCommandSchema.parse(payload);
  const actor = resolveActorId(initiatedBy);
  const guests = await findMergePair(
    tenantId,
    command.primary_guest_id,
    command.duplicate_guest_id,
  );

  const primary = guests.rows.find((guest) => guest.id === command.primary_guest_id);
  const duplicate = guests.rows.find((guest) => guest.id === command.duplicate_guest_id);

  if (!primary || !duplicate) {
    throw new CommandError(
      "GUEST_MERGE_TARGETS_NOT_FOUND",
      "Merge source or target guest not found",
    );
  }

  const merged = mergeGuestRows(primary, duplicate, command);

  await applyMergedGuestFields([
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
  ]);

  await retireMergedDuplicate(tenantId, primary.id, duplicate.id, actor);

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

  await recordAuditLog({
    tenantId,
    propertyId: null,
    actorId: actor,
    action: "guest.merge",
    eventType: "MERGE",
    entityType: "guest",
    entityId: primary.id,
    metadata: {
      primary_guest_id: hashIdentifier(primary.id),
      duplicate_guest_id: hashIdentifier(duplicate.id),
      correlationId,
      redacted_primary: redactPayload(primary),
      redacted_duplicate: redactPayload(duplicate),
    },
  });

  return { primaryGuestId: primary.id };
};

// GuestUpdateOptions imported from @tartware/schemas

/**
 * Update guest profile attributes with partial fields.
 */
export const updateGuestProfile = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestUpdateProfileCommandSchema.parse(payload);
  const actor = resolveActorId(initiatedBy);
  const normalizedPhone = normalizePhoneNumber(command.phone ?? undefined);
  const address = normalizeAddress(command.address ?? null);
  const preferences = command.preferences !== undefined ? command.preferences : null;
  const marketingConsent = command.preferences?.marketing_consent ?? undefined;

  const { rowCount } = await applyGuestProfileUpdate([
    tenantId,
    command.guest_id,
    command.first_name ?? null,
    command.last_name ?? null,
    command.email ?? null,
    normalizedPhone ?? null,
    command.title ?? null,
    command.nationality ?? null,
    command.gender ?? null,
    command.date_of_birth ?? null,
    command.company_name ?? null,
    address ? JSON.stringify(address) : null,
    preferences ? JSON.stringify(preferences) : null,
    marketingConsent ?? null,
    actor,
  ]);

  if (!rowCount || rowCount === 0) {
    throw new CommandError("GUEST_NOT_FOUND", "Guest not found");
  }

  guestCommandLogger.info("guest.update_profile command applied");

  await recordAuditLog({
    tenantId,
    propertyId: null,
    actorId: actor,
    action: "guest.update_profile",
    eventType: "UPDATE",
    entityType: "guest",
    entityId: command.guest_id,
    metadata: {
      guest_id: hashIdentifier(command.guest_id),
      correlationId,
      redacted_payload: redactPayload(command),
    },
  });
};

/**
 * Update guest contact information (email/phone/address).
 */
export const updateGuestContact = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestUpdateContactCommandSchema.parse(payload);
  const actor = resolveActorId(initiatedBy);
  const normalizedPhone = normalizePhoneNumber(command.phone ?? undefined);
  const address = normalizeAddress(command.address ?? null);

  const { rowCount } = await applyGuestContactUpdate([
    tenantId,
    command.guest_id,
    command.email ?? null,
    normalizedPhone ?? null,
    address ? JSON.stringify(address) : null,
    actor,
  ]);

  if (!rowCount || rowCount === 0) {
    throw new CommandError("GUEST_NOT_FOUND", "Guest not found");
  }

  guestCommandLogger.info("guest.update_contact command applied");

  await recordAuditLog({
    tenantId,
    propertyId: null,
    actorId: actor,
    action: "guest.update_contact",
    eventType: "UPDATE",
    entityType: "guest",
    entityId: command.guest_id,
    metadata: {
      guest_id: hashIdentifier(command.guest_id),
      correlationId,
      redacted_payload: redactPayload(command),
    },
  });
};

/**
 * Adjust guest loyalty tier and points with audit notes.
 */
export const setGuestLoyalty = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestSetLoyaltyCommandSchema.parse(payload);
  const actor = resolveActorId(initiatedBy);

  const delta = typeof command.points_delta === "number" ? command.points_delta : null;

  // Pre-check: reject deductions that would result in a negative balance
  if (delta !== null && delta < 0) {
    const { rows: currentRows } = await findLoyaltyPoints(tenantId, command.guest_id);
    const currentPoints = Number(currentRows[0]?.loyalty_points ?? 0);
    if (currentPoints + delta < 0) {
      throw new CommandError(
        "INSUFFICIENT_LOYALTY_POINTS",
        `Cannot deduct ${Math.abs(delta)} points from a balance of ${currentPoints}`,
      );
    }
  }

  const { rowCount } = await adjustLoyalty(
    tenantId,
    command.guest_id,
    command.loyalty_tier ?? null,
    delta,
    command.reason ?? null,
    actor,
  );

  if (!rowCount || rowCount === 0) {
    throw new CommandError("GUEST_NOT_FOUND", "Guest not found");
  }

  guestCommandLogger.info("guest.set_loyalty command applied");

  await recordAuditLog({
    tenantId,
    propertyId: null,
    actorId: actor,
    action: "guest.set_loyalty",
    eventType: "UPDATE",
    entityType: "guest",
    entityId: command.guest_id,
    metadata: {
      guest_id: hashIdentifier(command.guest_id),
      loyalty_tier: command.loyalty_tier,
      points_delta: delta,
      reason: command.reason,
      correlationId,
    },
  });
};

/**
 * Set guest VIP level and optional reason.
 */
export const setGuestVip = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestSetVipCommandSchema.parse(payload);
  const actor = resolveActorId(initiatedBy);

  const { rowCount } = await setVipStatus(
    tenantId,
    command.guest_id,
    command.vip_level,
    command.reason ?? null,
    actor,
  );

  if (!rowCount || rowCount === 0) {
    throw new CommandError("GUEST_NOT_FOUND", "Guest not found");
  }

  guestCommandLogger.info("guest.set_vip command applied");

  await recordAuditLog({
    tenantId,
    propertyId: null,
    actorId: actor,
    action: "guest.set_vip",
    eventType: "UPDATE",
    entityType: "guest",
    entityId: command.guest_id,
    metadata: {
      guest_id: hashIdentifier(command.guest_id),
      vip_level: command.vip_level,
      reason: command.reason,
      correlationId,
    },
  });
};

/**
 * Set guest blacklist status and optional reason.
 */
export const setGuestBlacklist = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestSetBlacklistCommandSchema.parse(payload);
  const actor = resolveActorId(initiatedBy);

  const { rowCount } = await setBlacklistStatus(
    tenantId,
    command.guest_id,
    command.is_blacklisted,
    command.reason ?? null,
    actor,
  );

  if (!rowCount || rowCount === 0) {
    throw new CommandError("GUEST_NOT_FOUND", "Guest not found");
  }

  guestCommandLogger.info("guest.set_blacklist command applied");

  await recordAuditLog({
    tenantId,
    propertyId: null,
    actorId: actor,
    action: "guest.set_blacklist",
    eventType: "UPDATE",
    entityType: "guest",
    entityId: command.guest_id,
    metadata: {
      guest_id: hashIdentifier(command.guest_id),
      is_blacklisted: command.is_blacklisted,
      reason: command.reason,
      correlationId,
    },
  });
};

/**
 * Erase a guest for GDPR compliance with cascade anonymization.
 */
export const eraseGuestForGdpr = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestGdprEraseCommandSchema.parse(payload);
  const actor = resolveActorId(initiatedBy);
  const redactedEmail = `gdpr+${command.guest_id}@redacted.invalid`;
  const redactedName = "Deleted Guest";

  // Check if guest is already deleted for idempotency
  const existingGuest = await findGuestDeletionState(tenantId, command.guest_id);

  if (!existingGuest.rowCount || existingGuest.rowCount === 0) {
    throw new CommandError("GUEST_NOT_FOUND", "Guest not found");
  }

  // Idempotent: if already deleted, log and return success
  if (existingGuest.rows[0]?.is_deleted) {
    guestCommandLogger.info(
      { tenantId, guestId: command.guest_id, correlationId, initiatedBy },
      "guest.gdpr.erase already applied (idempotent)",
    );
    return;
  }

  const gdprMetadata = JSON.stringify(
    appendMetadata(command.metadata ?? null, {
      gdpr_erased_at: new Date().toISOString(),
      gdpr_reason: command.reason ?? null,
    }),
  );

  await withTransaction(async (client) => {
    // Audit trail for GDPR compliance
    const cascadeAudit: Record<string, number> = {};

    // 1. Update the guest record itself
    const { rowCount } = await queryWithClient(
      client,
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
          version = version + 1,
          updated_at = NOW(),
          updated_by = $5
        WHERE tenant_id = $1::uuid
          AND id = $2::uuid
          AND COALESCE(is_deleted, false) = false
      `,
      [tenantId, command.guest_id, redactedEmail, gdprMetadata, actor],
    );

    if (!rowCount || rowCount === 0) {
      throw new CommandError("GUEST_NOT_FOUND", "Guest not found");
    }
    cascadeAudit.guests = rowCount;

    // 2. Cascade anonymization to folios (has guest_name)
    const foliosResult = await queryWithClient(
      client,
      `
        UPDATE public.folios
        SET guest_name = $3, updated_at = NOW()
        WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
      `,
      [tenantId, command.guest_id, redactedName],
    );
    cascadeAudit.folios = foliosResult.rowCount ?? 0;

    // 3. Cascade anonymization to ota_reservations_queue
    const otaResult = await queryWithClient(
      client,
      `
        UPDATE public.ota_reservations_queue
        SET guest_name = $3, guest_email = NULL, guest_phone = NULL, updated_at = NOW()
        WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
      `,
      [tenantId, command.guest_id, redactedName],
    );
    cascadeAudit.ota_reservations_queue = otaResult.rowCount ?? 0;

    // 4. Cascade anonymization to gds_reservation_queue
    const gdsResult = await queryWithClient(
      client,
      `
        UPDATE public.gds_reservation_queue
        SET guest_name = $3, guest_email = NULL, guest_phone = NULL, updated_at = NOW()
        WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
      `,
      [tenantId, command.guest_id, redactedName],
    );
    cascadeAudit.gds_reservation_queue = gdsResult.rowCount ?? 0;

    // 5. Cascade anonymization to lost_and_found
    const lostFoundResult = await queryWithClient(
      client,
      `
        UPDATE public.lost_and_found
        SET guest_name = $3, guest_email = NULL, guest_phone = NULL, updated_at = NOW()
        WHERE tenant_id = $1::uuid AND claimed_by_guest_id = $2::uuid
      `,
      [tenantId, command.guest_id, redactedName],
    );
    cascadeAudit.lost_and_found = lostFoundResult.rowCount ?? 0;

    // 6. Cascade anonymization to transportation_requests
    const transportResult = await queryWithClient(
      client,
      `
        UPDATE public.transportation_requests
        SET guest_name = $3, guest_email = NULL, guest_phone = NULL, updated_at = NOW()
        WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
      `,
      [tenantId, command.guest_id, redactedName],
    );
    cascadeAudit.transportation_requests = transportResult.rowCount ?? 0;

    // 7. Cascade anonymization to digital_registration_cards
    const regCardsResult = await queryWithClient(
      client,
      `
        UPDATE public.digital_registration_cards
        SET guest_email = NULL, guest_phone = NULL, updated_at = NOW()
        WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
      `,
      [tenantId, command.guest_id],
    );
    cascadeAudit.digital_registration_cards = regCardsResult.rowCount ?? 0;

    // 8. Cascade anonymization to incident_reports
    const incidentsResult = await queryWithClient(
      client,
      `
        UPDATE public.incident_reports
        SET guest_name = $3, updated_at = NOW()
        WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
      `,
      [tenantId, command.guest_id, redactedName],
    );
    cascadeAudit.incident_reports = incidentsResult.rowCount ?? 0;

    // 9. Cascade anonymization to guest_preferences (health/accessibility/personal data)
    const prefsResult = await queryWithClient(
      client,
      `
        UPDATE public.guest_preferences
        SET
          dietary_restrictions = NULL,
          food_allergies = NULL,
          accessibility_notes = NULL,
          mobility_accessible = false,
          hearing_accessible = false,
          visual_accessible = false,
          service_animal = false,
          preferred_language = NULL,
          preferred_contact_method = NULL,
          marketing_opt_in = false,
          newsletter_opt_in = false,
          sms_opt_in = false,
          notes = NULL,
          internal_notes = NULL,
          children_ages = NULL,
          number_of_children = NULL,
          pet_type = NULL,
          celebration_dates = NULL,
          occasions = NULL,
          preferred_room_numbers = NULL,
          avoid_room_numbers = NULL,
          updated_at = NOW()
        WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
      `,
      [tenantId, command.guest_id],
    );
    cascadeAudit.guest_preferences = prefsResult.rowCount ?? 0;

    // 10. Cascade anonymization to guest_documents (identity docs — high-sensitivity PII)
    const docsResult = await queryWithClient(
      client,
      `
        UPDATE public.guest_documents
        SET
          document_number = 'REDACTED',
          document_name = $3,
          description = NULL,
          file_path = NULL,
          file_name = NULL,
          verification_notes = NULL,
          upload_device_info = NULL,
          notes = NULL,
          updated_at = NOW()
        WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
      `,
      [tenantId, command.guest_id, redactedName],
    );
    cascadeAudit.guest_documents = docsResult.rowCount ?? 0;

    // 11. Cascade anonymization to guest_communications (messages with PII)
    const commsResult = await queryWithClient(
      client,
      `
        UPDATE public.guest_communications
        SET
          sender_name = $3,
          sender_email = NULL,
          sender_phone = NULL,
          recipient_name = $3,
          recipient_email = NULL,
          recipient_phone = NULL,
          subject = 'REDACTED',
          message = 'REDACTED',
          attachments = NULL,
          updated_at = NOW()
        WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
      `,
      [tenantId, command.guest_id, redactedName],
    );
    cascadeAudit.guest_communications = commsResult.rowCount ?? 0;

    // Log GDPR audit trail for compliance
    guestCommandLogger.info(
      {
        tenantId,
        guestId: command.guest_id,
        correlationId,
        initiatedBy,
        cascadeAudit,
      },
      "guest.gdpr.erase cascade audit - records anonymized per table",
    );
  });

  guestCommandLogger.info("guest.gdpr.erase command applied with cascade to related tables");

  await recordAuditLog({
    tenantId,
    propertyId: null,
    actorId: actor,
    action: "guest.gdpr.erase",
    eventType: "DELETE",
    entityType: "guest",
    entityId: command.guest_id,
    metadata: {
      guest_id: hashIdentifier(command.guest_id),
      reason: command.reason,
      gdpr_compliant: true,
    },
  });
};

/**
 * Update guest preference settings and marketing consent.
 */
export const updateGuestPreferences = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestPreferenceUpdateCommandSchema.parse(payload);
  const actor = resolveActorId(initiatedBy);
  const marketingConsent = command.preferences?.marketing_consent ?? undefined;

  const { rowCount } = await mergeGuestPreferences(
    tenantId,
    command.guest_id,
    JSON.stringify(command.preferences ?? {}),
    marketingConsent ?? null,
    actor,
  );

  if (!rowCount || rowCount === 0) {
    throw new CommandError("GUEST_NOT_FOUND", "Guest not found");
  }

  guestCommandLogger.info(
    { tenantId, guestId: command.guest_id, correlationId, initiatedBy },
    "guest.preference.update command applied",
  );
};

/**
 * Record a guest's consent decisions (GDPR Art. 7).
 *
 * The write itself lives in privacy-service, which owns the append-only consent
 * log and keeps `guests.marketing_consent` in step with the email toggle. This
 * handler is the command-bus entry to it: validate, apply, audit.
 *
 * The audit metadata carries which toggles changed and to what, but hashes the
 * guest id like the other guest commands here — a consent record must be
 * traceable without spreading raw subject ids through the audit log.
 */
export const updateGuestConsentDecision = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: GuestUpdateOptions): Promise<void> => {
  const command = GuestConsentUpdateCommandSchema.parse(payload);
  const actor = resolveActorId(initiatedBy);

  const { guest_id, metadata: _metadata, idempotency_key: _idempotencyKey, ...consent } = command;

  const ledger = await updateGuestConsent({
    guestId: guest_id,
    tenantId,
    consent,
    updatedBy: actor,
  });

  if (!ledger) {
    throw new CommandError("GUEST_NOT_FOUND", "Guest not found");
  }

  guestCommandLogger.info(
    { tenantId, guestId: guest_id, correlationId, initiatedBy },
    "guest.consent.update command applied",
  );

  await recordAuditLog({
    tenantId,
    propertyId: null,
    actorId: actor,
    action: "guest.consent.update",
    eventType: "UPDATE",
    entityType: "guest",
    entityId: guest_id,
    metadata: {
      guest_id: hashIdentifier(guest_id),
      consent,
      correlationId,
    },
  });
};

const mergeGuestRows = (primary: GuestRow, duplicate: GuestRow, payload: GuestMergeCommand) => {
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

  const mergedAddress = mergeRecord(duplicate.address ?? {}, primary.address ?? {});

  const mergedPreferences = mergeRecord(duplicate.preferences ?? {}, primary.preferences ?? {});

  // MED-005: Handle VIP+blacklist conflict - blacklist takes precedence
  // If either profile is blacklisted, the merged profile is blacklisted and NOT VIP
  const eitherBlacklisted = Boolean(primary.is_blacklisted || duplicate.is_blacklisted);
  // Pick the higher VIP level between primary and duplicate
  const vipLevels = ["NONE", "VIP1", "VIP2", "VIP3", "VIP4", "VIP5", "VVIP"];
  const primaryIdx = vipLevels.indexOf(primary.vip_status ?? "NONE");
  const duplicateIdx = vipLevels.indexOf(duplicate.vip_status ?? "NONE");
  const higherVip = vipLevels[Math.max(primaryIdx, duplicateIdx)] ?? "NONE";

  // Log conflict for audit trail
  if (eitherBlacklisted && higherVip !== "NONE") {
    guestCommandLogger.warn(
      {
        primaryGuestId: primary.id,
        duplicateGuestId: duplicate.id,
        primaryVip: primary.vip_status,
        duplicateVip: duplicate.vip_status,
        primaryBlacklisted: primary.is_blacklisted,
        duplicateBlacklisted: duplicate.is_blacklisted,
      },
      "Guest merge conflict: VIP status suppressed due to blacklist flag",
    );
  }

  return {
    phone: primary.phone ?? duplicate.phone ?? null,
    secondary_phone: primary.secondary_phone ?? duplicate.secondary_phone ?? null,
    address: mergedAddress,
    preferences: mergedPreferences,
    notes: mergedNotes || null,
    metadata: mergedMetadata,
    total_bookings: Number(primary.total_bookings ?? 0) + Number(duplicate.total_bookings ?? 0),
    total_nights: Number(primary.total_nights ?? 0) + Number(duplicate.total_nights ?? 0),
    total_revenue: Number(primary.total_revenue ?? 0) + Number(duplicate.total_revenue ?? 0),
    last_stay_date: pickLatestDate(primary.last_stay_date, duplicate.last_stay_date),
    loyalty_points: Number(primary.loyalty_points ?? 0) + Number(duplicate.loyalty_points ?? 0),
    loyalty_tier: primary.loyalty_tier ?? duplicate.loyalty_tier ?? null,
    // Blacklist takes precedence: if blacklisted, VIP is reset to NONE
    vip_status: eitherBlacklisted ? "NONE" : higherVip,
    is_blacklisted: eitherBlacklisted,
  };
};

const mergeRecord = (
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> => {
  return { ...base, ...overrides };
};

const pickLatestDate = (first: string | Date | null, second: string | Date | null): Date | null => {
  const firstDate = first ? new Date(first) : null;
  const secondDate = second ? new Date(second) : null;

  if (firstDate && secondDate) {
    return firstDate > secondDate ? firstDate : secondDate;
  }
  return firstDate ?? secondDate ?? null;
};
