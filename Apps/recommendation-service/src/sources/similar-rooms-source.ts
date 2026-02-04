/**
 * SimilarRoomsSource - Fetches rooms similar to guest's previous bookings.
 *
 * This is the "Phoenix Retrieval" equivalent - finding out-of-network
 * candidates based on similarity to past preferences.
 *
 * In a full implementation, this would use ML embeddings. For now, we
 * use rule-based similarity matching.
 */

import { BaseSource, type PipelineContext } from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class SimilarRoomsSource extends BaseSource<
  RoomRecommendationQuery,
  RoomCandidate
> {
  readonly name = "similar_rooms";

  /**
   * Only enable if we have guest history to base similarity on.
   */
  enable(queryParams: RoomRecommendationQuery): boolean {
    return (
      queryParams.guestId !== undefined &&
      queryParams.guestHistory !== undefined &&
      queryParams.guestHistory.totalBookings > 0
    );
  }

  async getCandidates(
    queryParams: RoomRecommendationQuery,
    context: PipelineContext,
  ): Promise<RoomCandidate[]> {
    const history = queryParams.guestHistory!;

    context.logger.debug(
      {
        guestId: queryParams.guestId,
        previousRoomTypes: history.previousRoomTypes,
      },
      "Fetching similar rooms based on guest history",
    );

    // Find rooms similar to what the guest has booked before:
    // - Same room types they've enjoyed
    // - Similar price range (within 20% of their average)
    // - Not already in the available pool (handled by dedup filter)
    const result = await query<{
      room_id: string;
      room_type_id: string;
      room_type_name: string;
      room_number: string;
      floor: string;
      view_type: string | null;
      base_rate: number;
      status: string;
      max_occupancy: number;
    }>(
      `
      SELECT DISTINCT
        r.id AS room_id,
        r.room_type_id,
        rt.type_name AS room_type_name,
        r.room_number,
        r.floor,
        r.features->>'view' AS view_type,
        COALESCE(rt.base_price, 100) AS base_rate,
        LOWER(r.status::TEXT) AS status,
        rt.max_occupancy
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE r.property_id = $1
        AND r.tenant_id = $2
        AND LOWER(r.status::TEXT) IN ('available', 'vacant_clean', 'inspected')
        AND rt.max_occupancy >= $6
        AND r.is_deleted = false
        AND rt.is_deleted = false
        AND (
          -- Room types the guest has booked before
          rt.id = ANY($3::uuid[])
          -- Or similar price range
          OR COALESCE(rt.base_price, 100) BETWEEN $7 * 0.8 AND $7 * 1.2
        )
        AND NOT EXISTS (
          SELECT 1 FROM reservations res
          WHERE res.property_id = r.property_id
            AND res.room_number = r.room_number
            AND LOWER(res.status::TEXT) NOT IN ('cancelled', 'no_show', 'checked_out')
            AND res.check_in_date < $5
            AND res.check_out_date > $4
        )
      ORDER BY
        CASE WHEN rt.id = ANY($3::uuid[]) THEN 0 ELSE 1 END,
        ABS(COALESCE(rt.base_price, 100) - $7) ASC
      LIMIT 50
      `,
      [
        queryParams.propertyId,
        queryParams.tenantId,
        history.previousRoomTypes,
        queryParams.checkInDate,
        queryParams.checkOutDate,
        queryParams.adults + queryParams.children,
        history.averageRate,
      ],
    );

    const candidates: RoomCandidate[] = result.rows.map((row) => ({
      roomId: row.room_id,
      roomTypeId: row.room_type_id,
      roomTypeName: row.room_type_name,
      roomNumber: row.room_number,
      floor: row.floor,
      viewType: row.view_type ?? undefined,
      baseRate: Number(row.base_rate),
      status: row.status,
      maxOccupancy: row.max_occupancy,
      source: this.name,
    }));

    context.logger.debug(
      { count: candidates.length },
      "Similar rooms fetched",
    );
    return candidates;
  }
}
