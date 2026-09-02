/**
 * DEV DOC
 * Module: guest-communication-repository.ts
 * Purpose: Reads over guest_communications — the sent-message ledger the
 *          dispatcher checks before sending and the history endpoints serve.
 * Ownership: notification-service
 *
 * Lifted verbatim out of `services/notification-dispatch-service.ts`.
 */

import { query } from "../lib/db.js";

const FIND_COMMUNICATION_BY_IDEMPOTENCY_KEY_SQL = `
        SELECT id, status
        FROM guest_communications
        WHERE tenant_id = $1::uuid
          AND metadata @> jsonb_build_object('idempotencyKey', $2::text)
        LIMIT 1
      `;

const SELECT_GUEST_COMMUNICATIONS_SQL = `SELECT id, tenant_id, property_id, guest_id, reservation_id,
            communication_type, direction, subject, status,
            sent_at, delivered_at, opened_at,
            external_message_id, created_at
     FROM guest_communications
     WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`;

const FIND_GUEST_COMMUNICATION_SQL = `SELECT id, tenant_id, property_id, guest_id, reservation_id,
            template_id, communication_type, direction, subject, message,
            sender_name, sender_email, recipient_name, recipient_email,
            recipient_phone, status, external_message_id,
            sent_at, delivered_at, opened_at, clicked_at,
            failed_at, failure_reason, attachments, metadata,
            created_by, created_at, updated_at
     FROM guest_communications
     WHERE tenant_id = $1::uuid AND id = $2::uuid`;

/**
 * Look up a prior send by idempotency key, so a retried dispatch does not
 * send the guest a second copy.
 */
export const findCommunicationByIdempotencyKey = (tenantId: string, idempotencyKey: string) =>
  query<{ id: string; status: string }>(FIND_COMMUNICATION_BY_IDEMPOTENCY_KEY_SQL, [
    tenantId,
    idempotencyKey,
  ]);

/**
 * A guest's communication history, newest first.
 */
export const selectGuestCommunications = (
  tenantId: string,
  guestId: string,
  limit: number,
  offset: number,
) => query(SELECT_GUEST_COMMUNICATIONS_SQL, [tenantId, guestId, limit, offset]);

/**
 * One communication with its template and delivery details.
 */
export const findGuestCommunication = (tenantId: string, communicationId: string) =>
  query(FIND_GUEST_COMMUNICATION_SQL, [tenantId, communicationId]);
