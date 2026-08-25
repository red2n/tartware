/**
 * DEV DOC
 * Module: checkout-repository.ts
 * Purpose: Reads backing guest self-checkout.
 * Ownership: guests-service
 *
 * Lifted verbatim out of `services/checkout-service.ts`.
 */

import { query } from "../lib/db.js";

const FIND_RESERVATION_BY_CONFIRMATION_CODE_SQL = `SELECT r.id, r.tenant_id, r.guest_id, r.property_id, r.room_number,
            r.check_out_date::text,
            r.status,
            COALESCE(f.balance, 0) AS folio_balance
     FROM reservations r
     LEFT JOIN LATERAL (
       SELECT balance FROM folios
       WHERE reservation_id = r.id AND tenant_id = r.tenant_id
         AND COALESCE(is_deleted, false) = false
       ORDER BY created_at DESC LIMIT 1
     ) f ON true
     WHERE r.confirmation_number = $1
       AND r.tenant_id = $2
       AND r.status = 'CHECKED_IN'
       AND r.is_deleted = false
     LIMIT 1`;

/**
 * Resolve a confirmation code to the reservation a guest is checking out of.
 */
export const findReservationByConfirmationCode = (confirmationCode: string, tenantId: string) =>
  query<{
    id: string;
    tenant_id: string;
    guest_id: string;
    property_id: string;
    room_number: string | null;
    check_out_date: string;
    status: string;
    folio_balance: string;
  }>(FIND_RESERVATION_BY_CONFIRMATION_CODE_SQL, [confirmationCode, tenantId]);
