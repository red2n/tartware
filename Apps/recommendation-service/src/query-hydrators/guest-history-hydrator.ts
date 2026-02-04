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
          r.id AS reservation_id,
          r.property_id,
          r.room_type_id,
          r.total_amount / NULLIF(r.check_out_date - r.check_in_date, 0) AS nightly_rate
        FROM reservations r
        WHERE r.guest_id = $1
          AND r.tenant_id = $2
          AND r.status = 'CHECKED_OUT'
          AND r.check_out_date IS NOT NULL
        ORDER BY r.check_out_date DESC
        LIMIT 20
      ),
      amenity_counts AS (
        SELECT amenity, COUNT(*) as cnt
        FROM (
          SELECT jsonb_array_elements_text(COALESCE(rt.amenities, '[]'::jsonb)) AS amenity
          FROM guest_reservations gr
          JOIN room_types rt ON gr.room_type_id = rt.id
        ) amenities
        GROUP BY amenity
        ORDER BY cnt DESC
        LIMIT 5
      )
      SELECT
        COALESCE(COUNT(*)::int, 0) AS total_bookings,
        COALESCE(ARRAY_AGG(DISTINCT room_type_id::text) FILTER (WHERE room_type_id IS NOT NULL), ARRAY[]::text[]) AS previous_room_types,
        COALESCE(ARRAY_AGG(DISTINCT property_id::text) FILTER (WHERE property_id IS NOT NULL), ARRAY[]::text[]) AS previous_properties,
        COALESCE(AVG(nightly_rate), 100) AS average_rate,
        COALESCE((SELECT ARRAY_AGG(amenity) FROM amenity_counts), ARRAY[]::text[]) AS preferred_amenities
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
