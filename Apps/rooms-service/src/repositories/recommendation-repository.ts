/**
 * DEV DOC
 * Module: recommendation-repository.ts
 * Purpose: Reads backing room recommendations — the guest's stated preferences
 *          and the candidate rooms the scorers rank.
 * Ownership: rooms-service
 *
 * Lifted verbatim out of `services/recommendation-service.ts`.
 */

import { pool } from "../lib/db.js";

const FIND_GUEST_ROOM_PREFERENCES_SQL = `SELECT
           preferences->>'roomType' AS preferred_room_type,
           preferences->>'floor' AS preferred_floor,
           COALESCE(
             ARRAY(
               SELECT jsonb_array_elements_text(preferences->'specialRequests')
             ),
             ARRAY[]::text[]
           ) AS preferred_amenities
         FROM guests
         WHERE id = $1 AND tenant_id = $2`;

const FIND_ROOMS_FOR_RECOMMENDATION_SQL = `SELECT r.id, r.room_number, r.floor, r.room_type_id,
            rt.type_name as room_type_name, rt.base_price as base_rate, rt.max_occupancy
     FROM rooms r
     JOIN room_types rt ON r.room_type_id = rt.id
     WHERE r.id = ANY($1) AND r.tenant_id = $2`;

/**
 * A guest's stated room preferences, used to seed recommendations.
 */
export const findGuestRoomPreferences = (guestId: string, tenantId: string) =>
  pool.query(FIND_GUEST_ROOM_PREFERENCES_SQL, [guestId, tenantId]);

/**
 * Hydrate candidate rooms with the attributes the scorers read.
 */
export const findRoomsForRecommendation = (roomIds: string[], tenantId: string) =>
  pool.query(FIND_ROOMS_FOR_RECOMMENDATION_SQL, [roomIds, tenantId]);
