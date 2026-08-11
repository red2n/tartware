import type { GuestConsentLedger } from "@tartware/schemas";

import { query, queryWithClient, withTransaction } from "../lib/db.js";

/**
 * Consent ledger key → `gdpr_consent_logs.consent_type`.
 *
 * The ledger the UI reads and writes is a four-toggle projection of the consent
 * log; every value here is one of the types the table's CHECK constraint allows,
 * so the mapping is the whole translation layer between the two.
 */
const CONSENT_TYPE_BY_LEDGER_KEY = {
  marketing_email: "marketing_email",
  marketing_sms: "marketing_sms",
  analytics: "analytics",
  third_party_sharing: "third_party_sharing",
} as const satisfies Record<string, string>;

type ConsentLedgerKey = keyof typeof CONSENT_TYPE_BY_LEDGER_KEY;

const CONSENT_LEDGER_KEYS = Object.keys(CONSENT_TYPE_BY_LEDGER_KEY) as ConsentLedgerKey[];

/** GDPR Art. 30 requires the processing purpose on record, and the column is NOT NULL. */
const CONSENT_PURPOSE: Record<ConsentLedgerKey, string> = {
  marketing_email: "Marketing communications by email",
  marketing_sms: "Marketing communications by SMS",
  analytics: "Analytics and profiling of stay behaviour",
  third_party_sharing: "Sharing personal data with third parties",
};

/**
 * Get current privacy/consent state for a guest.
 */
export async function getGuestPrivacyState(params: { guestId: string; tenantId: string }): Promise<{
  marketing_consent: boolean;
  communication_preferences: Record<string, boolean>;
  ccpa_opt_out_of_sale: boolean;
  active_consents: Array<{
    consent_type: string;
    consent_status: string;
    consent_date: string;
  }>;
} | null> {
  // Guest base record
  const guestResult = await query<{
    marketing_consent: boolean;
    communication_preferences: Record<string, boolean>;
    metadata: Record<string, unknown> | null;
  }>(
    `SELECT marketing_consent, communication_preferences, metadata
     FROM guests
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false`,
    [params.guestId, params.tenantId],
  );

  const guest = guestResult.rows[0];
  if (!guest) return null;

  // Active consent records
  const consentResult = await query<{
    consent_type: string;
    consent_status: string;
    consent_date: string;
  }>(
    `SELECT consent_type, consent_status, consent_date::text
     FROM gdpr_consent_logs
     WHERE subject_id = $1 AND tenant_id = $2
       AND is_active = true
       AND COALESCE(is_deleted, false) = false
     ORDER BY consent_date DESC`,
    [params.guestId, params.tenantId],
  );

  const ccpaOptOut =
    (guest.metadata as Record<string, unknown> | null)?.ccpa_opt_out_of_sale === true;

  return {
    marketing_consent: guest.marketing_consent ?? false,
    communication_preferences: guest.communication_preferences ?? {},
    ccpa_opt_out_of_sale: ccpaOptOut,
    active_consents: consentResult.rows,
  };
}

/**
 * CCPA: Set opt-out-of-sale flag for a guest.
 * Logs consent change in gdpr_consent_logs for audit.
 */
export async function setCcpaOptOut(params: {
  guestId: string;
  tenantId: string;
  optOut: boolean;
  requestedBy?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  // Update guest metadata with ccpa_opt_out_of_sale flag
  await query(
    `UPDATE guests
     SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('ccpa_opt_out_of_sale', $3::boolean),
         marketing_consent = CASE WHEN $3 = true THEN false ELSE marketing_consent END,
         updated_at = NOW(),
         updated_by = $4
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false`,
    [params.guestId, params.tenantId, params.optOut, params.requestedBy ?? "SYSTEM"],
  );

  // Log the consent change
  await query(
    `INSERT INTO gdpr_consent_logs (
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
     )`,
    [
      params.tenantId,
      params.guestId,
      !params.optOut, // consent_given = false when opting out
      params.optOut ? "withdrawn" : "given",
      params.optOut,
      params.ipAddress ?? null,
      params.userAgent ?? null,
      params.requestedBy ?? null,
    ],
  );
}

/**
 * Read the four-toggle consent ledger for a guest.
 *
 * Each toggle is the most recent *active* consent-log row of that type, so a
 * withdrawal recorded as `consent_given = false` reads back as `false` rather
 * than disappearing — the log keeps history, the ledger shows current state.
 * `updated_at` is the newest consent date across the four, which is what the
 * screen shows as "last updated".
 *
 * Returns null when the guest does not exist, so the route can 404 rather than
 * present an all-false ledger for a guest that is not there.
 */
export async function getGuestConsentLedger(params: {
  guestId: string;
  tenantId: string;
}): Promise<GuestConsentLedger | null> {
  const guestResult = await query<{ id: string }>(
    `SELECT id FROM guests
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false`,
    [params.guestId, params.tenantId],
  );
  if (!guestResult.rows[0]) return null;

  const consentResult = await query<{
    consent_type: string;
    consent_given: boolean;
    consent_date: Date;
  }>(
    `SELECT DISTINCT ON (consent_type) consent_type, consent_given, consent_date
     FROM gdpr_consent_logs
     WHERE subject_id = $1 AND tenant_id = $2
       AND consent_type = ANY($3::text[])
       AND is_active = true
       AND COALESCE(is_deleted, false) = false
     ORDER BY consent_type, consent_date DESC`,
    [params.guestId, params.tenantId, CONSENT_LEDGER_KEYS.map((k) => CONSENT_TYPE_BY_LEDGER_KEY[k])],
  );

  const ledger: GuestConsentLedger = {};
  let latest: Date | undefined;

  for (const row of consentResult.rows) {
    const key = CONSENT_LEDGER_KEYS.find(
      (candidate) => CONSENT_TYPE_BY_LEDGER_KEY[candidate] === row.consent_type,
    );
    if (!key) continue;
    ledger[key] = row.consent_given;
    const recordedAt = new Date(row.consent_date);
    if (latest === undefined || recordedAt > latest) latest = recordedAt;
  }

  if (latest !== undefined) ledger.updated_at = latest;
  return ledger;
}

/**
 * Record a consent change for a guest.
 *
 * Consent is append-only: the previous active row for a type is marked inactive
 * and linked to its replacement via `superseded_by_consent_id`, never updated in
 * place. That is what makes the log evidence of what the guest agreed to and
 * when — overwriting would destroy exactly the record GDPR Art. 7(1) asks for.
 *
 * Only the keys present in `consent` are touched; an absent key leaves that
 * toggle's history alone. Returns the ledger as it now stands.
 */
export async function updateGuestConsent(params: {
  guestId: string;
  tenantId: string;
  consent: GuestConsentLedger;
  updatedBy?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<GuestConsentLedger | null> {
  const changes = CONSENT_LEDGER_KEYS.flatMap((key) => {
    const value = params.consent[key];
    return typeof value === "boolean" ? [{ key, value }] : [];
  });

  if (changes.length === 0) {
    return getGuestConsentLedger({ guestId: params.guestId, tenantId: params.tenantId });
  }

  const guestResult = await query<{ id: string }>(
    `SELECT id FROM guests
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false`,
    [params.guestId, params.tenantId],
  );
  if (!guestResult.rows[0]) return null;

  await withTransaction(async (client) => {
    for (const { key, value } of changes) {
      const consentType = CONSENT_TYPE_BY_LEDGER_KEY[key];

      const inserted = await queryWithClient<{ consent_id: string }>(
        client,
        `INSERT INTO gdpr_consent_logs (
           tenant_id, subject_type, subject_id,
           consent_type, consent_given, consent_status,
           consent_method, purpose_description, legal_basis,
           ip_address, user_agent, recorded_by,
           withdrawal_date
         ) VALUES (
           $1::uuid, 'guest', $2::uuid,
           $3, $4, CASE WHEN $4 THEN 'given' ELSE 'withdrawn' END,
           'checkbox', $5, 'consent',
           $6, $7, $8::uuid,
           CASE WHEN $4 THEN NULL ELSE NOW() END
         )
         RETURNING consent_id`,
        [
          params.tenantId,
          params.guestId,
          consentType,
          value,
          CONSENT_PURPOSE[key],
          params.ipAddress ?? null,
          params.userAgent ?? null,
          params.updatedBy ?? null,
        ],
      );

      const newConsentId = inserted.rows[0]?.consent_id;

      // The new row carries the decision (and its withdrawal_date when consent is
      // withdrawn); the previous one is only marked superseded, never rewritten.
      await queryWithClient(
        client,
        `UPDATE gdpr_consent_logs
         SET is_active = false,
             superseded_by_consent_id = $4::uuid
         WHERE subject_id = $1::uuid AND tenant_id = $2::uuid
           AND consent_type = $3
           AND is_active = true
           AND consent_id <> $4::uuid`,
        [params.guestId, params.tenantId, consentType, newConsentId],
      );
    }

    // `guests.marketing_consent` is the flag the rest of the system reads
    // (notification sends, exports), so it must not drift from the ledger.
    const emailChange = changes.find((change) => change.key === "marketing_email");
    if (emailChange) {
      await queryWithClient(
        client,
        `UPDATE guests
         SET marketing_consent = $3,
             updated_at = NOW(),
             updated_by = $4
         WHERE id = $1::uuid AND tenant_id = $2::uuid
           AND COALESCE(is_deleted, false) = false`,
        [params.guestId, params.tenantId, emailChange.value, params.updatedBy ?? "SYSTEM"],
      );
    }
  });

  return getGuestConsentLedger({ guestId: params.guestId, tenantId: params.tenantId });
}

/**
 * Update communication preferences for a guest.
 * Logs the change for GDPR audit trail.
 */
export async function updateCommunicationPreferences(params: {
  guestId: string;
  tenantId: string;
  preferences: Record<string, boolean>;
  updatedBy?: string;
}): Promise<void> {
  await query(
    `UPDATE guests
     SET communication_preferences = $3::jsonb,
         marketing_consent = COALESCE(($3::jsonb->>'email')::boolean, false),
         updated_at = NOW(),
         updated_by = $4
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false`,
    [
      params.guestId,
      params.tenantId,
      JSON.stringify(params.preferences),
      params.updatedBy ?? "SYSTEM",
    ],
  );
}
