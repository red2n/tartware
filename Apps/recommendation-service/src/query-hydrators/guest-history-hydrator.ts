/**
 * GuestHistoryHydrator - Enriches query with guest's booking history.
 *
 * Fetches the guest's past bookings to understand preferences.
 */

import { BaseQueryHydrator, type PipelineContext } from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { GuestBookingHistory, RoomRecommendationQuery } from "../types.js";

export class GuestHistoryHydrator extends BaseQueryHydrator<RoomRecommendationQuery> {
  readonly name = "guest_history";

  /**
   * Only enable if we have a guest ID.
   */
  enable(queryParams: RoomRecommendationQuery): boolean {
    return queryParams.guestId !== undefined;
  }

  async hydrate(
    queryParams: RoomRecommendationQuery,
    context: PipelineContext,
  ): Promise<Partial<RoomRecommendationQuery>> {
    context.logger.debug(
      { guestId: queryParams.guestId },
      "Fetching guest booking history",
    );

    const result = await query<{
      total_bookings: number;
      previous_room_types: string[];
      previous_properties: string[];
      average_rate: number;
      preferred_amenities: string[];
    }>(
      `
      WITH guest_reservations AS (
        SELECT
          r.reservation_id,
          r.property_id,
          rr.room_type_id,
          r.total_amount / NULLIF(r.check_out_date - r.check_in_date, 0) AS nightly_rate
        FROM reservations r
        JOIN reservation_rooms rr ON r.reservation_id = rr.reservation_id
        WHERE r.guest_id = $1
          AND r.tenant_id = $2
          AND r.status IN ('checked_out', 'completed')
          AND r.check_out_date IS NOT NULL
        ORDER BY r.check_out_date DESC
        LIMIT 20
      ),
      guest_amenities AS (
        SELECT a.name, COUNT(*) as cnt
        FROM guest_reservations gr
        JOIN rooms rm ON rm.room_type_id = gr.room_type_id
        JOIN room_amenities ra ON rm.room_id = ra.room_id
        JOIN amenities a ON ra.amenity_id = a.amenity_id
        GROUP BY a.name
        ORDER BY cnt DESC
        LIMIT 5
      )
      SELECT
        COALESCE(COUNT(*)::int, 0) AS total_bookings,
        COALESCE(ARRAY_AGG(DISTINCT room_type_id::text) FILTER (WHERE room_type_id IS NOT NULL), ARRAY[]::text[]) AS previous_room_types,
        COALESCE(ARRAY_AGG(DISTINCT property_id::text) FILTER (WHERE property_id IS NOT NULL), ARRAY[]::text[]) AS previous_properties,
        COALESCE(AVG(nightly_rate), 100) AS average_rate,
        COALESCE((SELECT ARRAY_AGG(name) FROM guest_amenities), ARRAY[]::text[]) AS preferred_amenities
      FROM guest_reservations
      `,
      [queryParams.guestId, queryParams.tenantId],
    );

    const row = result.rows[0];
    const history: GuestBookingHistory = {
      totalBookings: row?.total_bookings ?? 0,
      previousRoomTypes: row?.previous_room_types ?? [],
      previousProperties: row?.previous_properties ?? [],
      averageRate: Number(row?.average_rate ?? 100),
      preferredAmenities: row?.preferred_amenities ?? [],
    };

    context.logger.debug(
      { totalBookings: history.totalBookings },
      "Guest history fetched",
    );

    return { guestHistory: history };
  }
}
