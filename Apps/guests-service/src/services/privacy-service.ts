import { query } from "../lib/db.js";

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
