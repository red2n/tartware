import { query } from "../lib/db.js";

/**
 * GDPR Subject Access Request (SAR) — Article 15 / Article 20 data export.
 * Aggregates all personal data held for a guest across tables.
 */
export async function exportGuestData(params: {
  guestId: string;
  tenantId: string;
}): Promise<Record<string, unknown> | null> {
  const { guestId, tenantId } = params;

  // 1. Guest profile
  const { rows: guestRows } = await query<Record<string, unknown>>(
    `SELECT id, first_name, last_name, middle_name, title,
            date_of_birth, gender, nationality,
            email, phone, secondary_phone, address,
            id_type, id_number, passport_number, passport_expiry,
            company_name, company_tax_id,
            loyalty_tier, loyalty_points, vip_status,
            preferences, marketing_consent, communication_preferences,
            total_bookings, total_nights, total_revenue,
            last_stay_date, member_since, first_stay_date,
            is_blacklisted, blacklist_reason, notes,
            created_at, updated_at
     FROM public.guests
     WHERE tenant_id = $1::uuid AND id = $2::uuid
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, guestId],
  );

  if (guestRows.length === 0) return null;

  // 2. Reservations
  const { rows: reservations } = await query<Record<string, unknown>>(
    `SELECT id, property_id, room_type_id, room_id,
            check_in_date, check_out_date, status,
            adults, children, total_amount, currency,
            booking_source, reservation_type, special_requests,
            created_at, updated_at
     FROM public.reservations
     WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
     ORDER BY created_at DESC`,
    [tenantId, guestId],
  );

  // 3. Payment transactions
  const { rows: payments } = await query<Record<string, unknown>>(
    `SELECT id, payment_reference, transaction_type, payment_method,
            amount, currency, status, processed_at,
            created_at
     FROM public.payments
     WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
     ORDER BY created_at DESC`,
    [tenantId, guestId],
  );

  // 4. GDPR consent logs
  const { rows: consents } = await query<Record<string, unknown>>(
    `SELECT consent_type, consent_status, consent_date,
            ip_address, consent_source, withdrawal_date
     FROM public.gdpr_consent_logs
     WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
     ORDER BY consent_date DESC`,
    [tenantId, guestId],
  );

  // 5. Loyalty transactions
  const { rows: loyaltyTxns } = await query<Record<string, unknown>>(
    `SELECT id, transaction_type, points, balance_after,
            reference_type, reference_id, description,
            expires_at, created_at
     FROM public.loyalty_point_transactions
     WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
     ORDER BY created_at DESC`,
    [tenantId, guestId],
  );

  // 6. In-app notifications (communications sent)
  const { rows: notifications } = await query<Record<string, unknown>>(
    `SELECT id, channel, subject, status, sent_at, created_at
     FROM public.in_app_notifications
     WHERE tenant_id = $1::uuid
       AND source_type = 'guest'
       AND source_id = $2::uuid
     ORDER BY created_at DESC`,
    [tenantId, guestId],
  );

  return {
    personal_data: guestRows[0],
    reservations,
    payment_transactions: payments,
    consent_records: consents,
    loyalty_transactions: loyaltyTxns,
    communications: notifications,
    data_categories: [
      "identity",
      "contact",
      "financial",
      "booking_history",
      "loyalty",
      "preferences",
      "consent",
      "communications",
    ],
  };
}
