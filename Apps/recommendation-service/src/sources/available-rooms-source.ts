/**
 * AvailableRoomsSource - Fetches available rooms from the inventory.
 *
 * This is the "Thunder" equivalent - fetching in-network candidates
 * (rooms that are actually available for the requested dates).
 */

import { BaseSource, type PipelineContext } from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class AvailableRoomsSource extends BaseSource<
  RoomRecommendationQuery,
  RoomCandidate
> {
  readonly name = "available_rooms";

  async getCandidates(
    queryParams: RoomRecommendationQuery,
    context: PipelineContext,
  ): Promise<RoomCandidate[]> {
    context.logger.debug(
      {
        propertyId: queryParams.propertyId,
        checkIn: queryParams.checkInDate,
        checkOut: queryParams.checkOutDate,
      },
      "Fetching available rooms",
    );

    // Query available rooms that:
    // 1. Belong to the property
    // 2. Have status 'available' or 'clean'
    // 3. Are not locked/reserved for the requested dates
    // 4. Can accommodate the guest count
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
      SELECT
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
        AND rt.max_occupancy >= $5
        AND r.is_deleted = false
        AND rt.is_deleted = false
        AND NOT EXISTS (
          SELECT 1 FROM reservations res
          WHERE res.property_id = r.property_id
            AND res.room_number = r.room_number
            AND LOWER(res.status::TEXT) NOT IN ('cancelled', 'no_show', 'checked_out')
            AND res.check_in_date < $4
            AND res.check_out_date > $3
        )
      ORDER BY rt.base_price ASC
      LIMIT 100
      `,
      [
        queryParams.propertyId,
        queryParams.tenantId,
        queryParams.checkInDate,
        queryParams.checkOutDate,
        queryParams.adults + queryParams.children,
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
      "Available rooms fetched",
    );
    return candidates;
  }
}
