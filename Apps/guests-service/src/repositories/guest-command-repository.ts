/**
 * DEV DOC
 * Module: guest-command-repository.ts
 * Purpose: Every statement behind the guest command handlers — profile and
 *          contact edits, merges, loyalty adjustments, VIP and blacklist flags.
 * Ownership: guests-service (owner of the guests table)
 *
 * Lifted verbatim out of `services/guest-command-service.ts`.
 */

import type { GuestCommandRow } from "@tartware/schemas";

import { query } from "../lib/db.js";

const UPSERT_GUEST_SQL = `
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
        $12,
        $13,
        $14,
        $15,
        $16,
        $17::date,
        $18
      ) AS guest_id
    `;

const FIND_MERGE_PAIR_SQL = `
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
    `;

const APPLY_MERGED_GUEST_FIELDS_SQL = `
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
        version = version + 1,
        updated_at = NOW(),
        updated_by = $17
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
    `;

const RETIRE_MERGED_DUPLICATE_SQL = `
      UPDATE public.guests
      SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = $4,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('merged_into', $2::text, 'merged_at', NOW()),
        version = version + 1
      WHERE tenant_id = $1::uuid
        AND id = $3::uuid
    `;

const APPLY_GUEST_PROFILE_UPDATE_SQL = `
      UPDATE public.guests
      SET
        first_name = COALESCE($3, first_name),
        last_name = COALESCE($4, last_name),
        email = COALESCE($5, email),
        phone = COALESCE($6, phone),
        title = COALESCE($7, title),
        nationality = COALESCE($8, nationality),
        gender = COALESCE($9, gender),
        date_of_birth = COALESCE(NULLIF($10,'')::date, date_of_birth),
        company_name = COALESCE($11, company_name),
        address = CASE
          WHEN $12::jsonb IS NULL THEN address
          ELSE COALESCE(address, '{}'::jsonb) || $12::jsonb
        END,
        preferences = CASE
          WHEN $13::jsonb IS NULL THEN preferences
          ELSE COALESCE(preferences, '{}'::jsonb) || $13::jsonb
        END,
        marketing_consent = COALESCE($14, marketing_consent),
        version = version + 1,
        updated_at = NOW(),
        updated_by = $15
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const APPLY_GUEST_CONTACT_UPDATE_SQL = `
      UPDATE public.guests
      SET
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        address = CASE
          WHEN $5::jsonb IS NULL THEN address
          ELSE COALESCE(address, '{}'::jsonb) || $5::jsonb
        END,
        version = version + 1,
        updated_at = NOW(),
        updated_by = $6
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const FIND_LOYALTY_POINTS_SQL = `SELECT loyalty_points FROM public.guests
       WHERE tenant_id = $1::uuid AND id = $2::uuid AND COALESCE(is_deleted, false) = false`;

const ADJUST_LOYALTY_SQL = `
      UPDATE public.guests
      SET
        loyalty_tier = COALESCE($3, loyalty_tier),
        loyalty_points = CASE
          WHEN $4::numeric IS NULL THEN loyalty_points
          ELSE COALESCE(loyalty_points, 0) + $4::numeric
        END,
        notes = CASE
          WHEN $5::text IS NULL THEN notes
          WHEN notes IS NULL THEN $5::text
          ELSE CONCAT_WS(E'\\n', notes, $5::text)
        END,
        version = version + 1,
        updated_at = NOW(),
        updated_by = $6
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      RETURNING loyalty_points
    `;

const SET_VIP_STATUS_SQL = `
      UPDATE public.guests
      SET
        vip_status = $3,
        notes = CASE
          WHEN $4::text IS NULL THEN notes
          WHEN notes IS NULL THEN $4::text
          ELSE CONCAT_WS(E'\\n', notes, $4::text)
        END,
        version = version + 1,
        updated_at = NOW(),
        updated_by = $5
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const SET_BLACKLIST_STATUS_SQL = `
      UPDATE public.guests
      SET
        is_blacklisted = $3,
        blacklist_reason = COALESCE($4, blacklist_reason),
        version = version + 1,
        updated_at = NOW(),
        updated_by = $5
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const FIND_GUEST_DELETION_STATE_SQL = `SELECT id, is_deleted FROM public.guests WHERE tenant_id = $1::uuid AND id = $2::uuid`;

const MERGE_GUEST_PREFERENCES_SQL = `
      UPDATE public.guests
      SET
        preferences = COALESCE(preferences, '{}'::jsonb) || $3::jsonb,
        marketing_consent = COALESCE($4, marketing_consent),
        version = version + 1,
        updated_at = NOW(),
        updated_by = $5
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

/**
 * Create or update a guest through the upsert_guest stored function, which
 * owns the matching rules.
 */
export const upsertGuest = (values: unknown[]) =>
  query<{ guest_id: string }>(UPSERT_GUEST_SQL, values);

/**
 * Both sides of a merge in one read, so the caller cannot act on a pair
 * that has changed between two queries.
 */
export const findMergePair = (tenantId: string, primaryGuestId: string, duplicateGuestId: string) =>
  query<GuestCommandRow>(FIND_MERGE_PAIR_SQL, [tenantId, primaryGuestId, duplicateGuestId]);

/**
 * Write the merged field set onto the surviving guest.
 */
export const applyMergedGuestFields = (values: unknown[]) =>
  query(APPLY_MERGED_GUEST_FIELDS_SQL, values);

/**
 * Soft-delete the duplicate and point it at the surviving guest.
 */
export const retireMergedDuplicate = (
  tenantId: string,
  primaryId: string,
  duplicateId: string,
  actorId: string,
) => query(RETIRE_MERGED_DUPLICATE_SQL, [tenantId, primaryId, duplicateId, actorId]);

/**
 * Amend a guest's profile fields.
 */
export const applyGuestProfileUpdate = (values: unknown[]) =>
  query(APPLY_GUEST_PROFILE_UPDATE_SQL, values);

/**
 * Amend a guest's contact details.
 */
export const applyGuestContactUpdate = (values: unknown[]) =>
  query(APPLY_GUEST_CONTACT_UPDATE_SQL, values);

/**
 * A guest's current point balance.
 */
export const findLoyaltyPoints = (tenantId: string, guestId: string) =>
  query<{ loyalty_points: number | null }>(FIND_LOYALTY_POINTS_SQL, [tenantId, guestId]);

/**
 * Move a guest's tier and point balance together.
 */
export const adjustLoyalty = (
  tenantId: string,
  guestId: string,
  loyaltyTier: string | null,
  delta: number | null,
  reason: string | null,
  actorId: string,
) =>
  query<{ loyalty_points: number | null }>(ADJUST_LOYALTY_SQL, [
    tenantId,
    guestId,
    loyaltyTier,
    delta,
    reason,
    actorId,
  ]);

/**
 * Set or clear VIP status, appending the reason to the guest's notes.
 */
export const setVipStatus = (
  tenantId: string,
  guestId: string,
  vipLevel: string,
  reason: string | null,
  actorId: string,
) => query(SET_VIP_STATUS_SQL, [tenantId, guestId, vipLevel, reason, actorId]);

/**
 * Blacklist a guest or lift the block.
 */
export const setBlacklistStatus = (
  tenantId: string,
  guestId: string,
  isBlacklisted: boolean,
  reason: string | null,
  actorId: string,
) => query(SET_BLACKLIST_STATUS_SQL, [tenantId, guestId, isBlacklisted, reason, actorId]);

/**
 * Whether a guest exists and is already soft-deleted.
 */
export const findGuestDeletionState = (tenantId: string, guestId: string) =>
  query(FIND_GUEST_DELETION_STATE_SQL, [tenantId, guestId]);

/**
 * Merge a preference patch into the guest's stored preferences.
 */
export const mergeGuestPreferences = (
  tenantId: string,
  guestId: string,
  preferences: string,
  marketingConsent: boolean | null,
  actorId: string,
) =>
  query(MERGE_GUEST_PREFERENCES_SQL, [tenantId, guestId, preferences, marketingConsent, actorId]);
