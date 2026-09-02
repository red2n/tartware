/**
 * DEV DOC
 * Module: privacy-repository.ts
 * Purpose: Consent state and the GDPR consent ledger.
 * Ownership: guests-service
 *
 * Lifted verbatim out of `services/privacy-service.ts`.
 */

import { query } from "../lib/db.js";

const SELECT_MARKETING_CONSENT_SQL = `SELECT marketing_consent, communication_preferences, metadata
     FROM guests
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false`;

const SELECT_CONSENT_DECISIONS_SQL = `SELECT consent_type, consent_status, consent_date::text
     FROM gdpr_consent_logs
     WHERE subject_id = $1 AND tenant_id = $2
       AND is_active = true
       AND COALESCE(is_deleted, false) = false
     ORDER BY consent_date DESC`;

const APPLY_MARKETING_OPT_OUT_SQL = `UPDATE guests
     SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('ccpa_opt_out_of_sale', $3::boolean),
         marketing_consent = CASE WHEN $3 = true THEN false ELSE marketing_consent END,
         updated_at = NOW(),
         updated_by = $4
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false`;

const INSERT_CONSENT_LOG_SQL = `INSERT INTO gdpr_consent_logs (
       tenant_id, subject_type, subject_id,
       consent_type, consent_given, consent_status,
       consent_method, purpose_description, legal_basis,
       ccpa_compliant, ip_address, user_agent,
       recorded_by
     ) VALUES (
       $1, 'guest', $2,
       'data_sharing', $3, $4,
       'opt_out', 'CCPA Do Not Sell My Personal Information opt-' || CASE WHEN $5 THEN 'out' ELSE 'in' END,
       'consent',
       true, $6, $7,
       $8
     )`;

const FIND_GUEST_FOR_CONSENT_SQL = `SELECT id FROM guests
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false`;

const SELECT_CONSENT_LEDGER_SQL = `SELECT DISTINCT ON (consent_type) consent_type, consent_given, consent_date
     FROM gdpr_consent_logs
     WHERE subject_id = $1 AND tenant_id = $2
       AND consent_type = ANY($3::text[])
       AND is_active = true
       AND COALESCE(is_deleted, false) = false
     ORDER BY consent_type, consent_date DESC`;

const APPLY_COMMUNICATION_PREFERENCES_SQL = `UPDATE guests
     SET communication_preferences = $3::jsonb,
         marketing_consent = COALESCE(($3::jsonb->>'email')::boolean, false),
         updated_at = NOW(),
         updated_by = $4
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false`;

/**
 * The guest's marketing consent and communication preferences.
 */
export const selectMarketingConsent = (guestId: string, tenantId: string) =>
  query<{
    marketing_consent: boolean;
    communication_preferences: Record<string, boolean>;
    metadata: Record<string, unknown> | null;
  }>(SELECT_MARKETING_CONSENT_SQL, [guestId, tenantId]);

/**
 * Consent decisions by type.
 */
export const selectConsentDecisions = (guestId: string, tenantId: string) =>
  query<{
    consent_type: string;
    consent_status: string;
    consent_date: string;
  }>(SELECT_CONSENT_DECISIONS_SQL, [guestId, tenantId]);

/**
 * Record a marketing opt-out or opt-in on the guest record.
 */
export const applyMarketingOptOut = (params: {
  guestId: string;
  tenantId: string;
  optOut: boolean;
  reason?: string;
  requestedBy?: string;
}) =>
  query(APPLY_MARKETING_OPT_OUT_SQL, [
    params.guestId,
    params.tenantId,
    params.optOut,
    params.requestedBy ?? "SYSTEM",
  ]);

/**
 * Append to the immutable consent ledger.
 */
export const insertConsentLog = (params: {
  tenantId: string;
  guestId: string;
  optOut: boolean;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  requestedBy?: string;
}) =>
  query(INSERT_CONSENT_LOG_SQL, [
    params.tenantId,
    params.guestId,
    // consent_given is false when the guest is opting out
    !params.optOut,
    params.optOut ? "withdrawn" : "given",
    params.optOut,
    params.ipAddress ?? null,
    params.userAgent ?? null,
    params.requestedBy ?? null,
  ]);

/**
 * Confirm the guest exists before recording consent.
 */
export const findGuestForConsent = (guestId: string, tenantId: string) =>
  query<{ id: string }>(FIND_GUEST_FOR_CONSENT_SQL, [guestId, tenantId]);

/**
 * The latest decision per consent type, newest first.
 */
export const selectConsentLedger = (guestId: string, tenantId: string, consentTypes: string[]) =>
  query<{
    consent_type: string;
    consent_given: boolean;
    consent_date: Date;
  }>(SELECT_CONSENT_LEDGER_SQL, [guestId, tenantId, consentTypes]);

/**
 * Replace the guest's communication preferences.
 */
export const applyCommunicationPreferences = (params: {
  guestId: string;
  tenantId: string;
  preferences: unknown;
  updatedBy?: string;
}) =>
  query(APPLY_COMMUNICATION_PREFERENCES_SQL, [
    params.guestId,
    params.tenantId,
    JSON.stringify(params.preferences),
    params.updatedBy ?? "SYSTEM",
  ]);
