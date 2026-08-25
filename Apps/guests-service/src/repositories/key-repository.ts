/**
 * DEV DOC
 * Module: key-repository.ts
 * Purpose: Mobile key reads for a reservation.
 * Ownership: guests-service
 *
 * Statements moved verbatim out of `services/key-service.ts`.
 */

export const GET_ACTIVE_KEYS_SQL = `
  SELECT
    key_id, key_code, key_type, status,
    valid_from, valid_to, last_used_at, usage_count,
    room_id
  FROM mobile_keys
  WHERE reservation_id = $1
    AND tenant_id = $2
    AND status = 'active'
    AND is_deleted = FALSE
  ORDER BY created_at DESC
`;
