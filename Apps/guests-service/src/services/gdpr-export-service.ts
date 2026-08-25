import {
  selectGuestConsents,
  selectGuestLoyaltyTransactions,
  selectGuestNotifications,
  selectGuestPayments,
  selectGuestProfile,
  selectGuestReservations,
} from "../repositories/gdpr-export-repository.js";

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
  const { rows: guestRows } = await selectGuestProfile(tenantId, guestId);

  if (guestRows.length === 0) return null;

  // 2. Reservations
  const { rows: reservations } = await selectGuestReservations(tenantId, guestId);

  // 3. Payment transactions
  const { rows: payments } = await selectGuestPayments(tenantId, guestId);

  // 4. GDPR consent logs
  const { rows: consents } = await selectGuestConsents(tenantId, guestId);

  // 5. Loyalty transactions
  const { rows: loyaltyTxns } = await selectGuestLoyaltyTransactions(tenantId, guestId);

  // 6. In-app notifications (communications sent).
  // This table has no channel/subject/status/sent_at columns — it stores
  // notification_id, category, title and a read flag. Aliased so the export's
  // field names stay stable for anything already consuming them.
  const { rows: notifications } = await selectGuestNotifications(tenantId, guestId);

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
