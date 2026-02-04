/**
 * AmenityHydrator - Enriches candidates with room amenities.
 */

import { BaseHydrator, type PipelineContext } from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class AmenityHydrator extends BaseHydrator<
  RoomRecommendationQuery,
  RoomCandidate
> {
  readonly name = "amenity";

  async hydrate(
    _queryParams: RoomRecommendationQuery,
    candidates: readonly RoomCandidate[],
    context: PipelineContext,
  ): Promise<Partial<RoomCandidate>[]> {
    if (candidates.length === 0) {
      return [];
    }

    const roomIds = candidates.map((c) => c.roomId);
    context.logger.debug(
      { roomCount: roomIds.length },
      "Fetching room amenities",
    );

    const result = await query<{
      room_id: string;
      amenities: string[];
    }>(
      `
      SELECT
        r.room_id,
        COALESCE(ARRAY_AGG(a.name ORDER BY a.name), ARRAY[]::text[]) AS amenities
      FROM rooms r
      LEFT JOIN room_amenities ra ON r.room_id = ra.room_id
      LEFT JOIN amenities a ON ra.amenity_id = a.amenity_id
      WHERE r.room_id = ANY($1::uuid[])
      GROUP BY r.room_id
      `,
      [roomIds],
    );

    const amenityMap = new Map(
      result.rows.map((row) => [row.room_id, row.amenities]),
    );

    return candidates.map((c) => ({
      amenities: amenityMap.get(c.roomId) ?? [],
    }));
  }
}
