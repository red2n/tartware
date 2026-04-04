import type { KeyRow } from "@tartware/schemas";

import { query } from "../lib/db.js";

// ─── Key Queries ──────────────────────────────────────

const GET_ACTIVE_KEYS_SQL = `
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

/**
 * Get active mobile keys for a reservation.
 */
export const getActiveKeysForReservation = async (
  reservationId: string,
  tenantId: string,
): Promise<KeyRow[]> => {
  const { rows } = await query<KeyRow>(GET_ACTIVE_KEYS_SQL, [reservationId, tenantId]);
  return rows;
};
