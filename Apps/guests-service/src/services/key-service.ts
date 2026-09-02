import type { KeyRow } from "@tartware/schemas";

import { query } from "../lib/db.js";
import { GET_ACTIVE_KEYS_SQL } from "../repositories/key-repository.js";

// ─── Key Queries ──────────────────────────────────────

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
