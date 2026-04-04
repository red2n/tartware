/**
 * AmenityHydrator - Enriches candidates with room amenities.
 */

import { BaseHydrator, type PipelineContext } from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class AmenityHydrator extends BaseHydrator<RoomRecommendationQuery, RoomCandidate> {
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
    context.logger.debug({ roomCount: roomIds.length }, "Fetching room amenities");

    const result = await query<{
      room_id: string;
      amenities: string[];
    }>(
      `
      SELECT
        r.id AS room_id,
        COALESCE(
          ARRAY(
            SELECT DISTINCT amenity
            FROM (
              SELECT jsonb_array_elements_text(COALESCE(rt.amenities, '[]'::jsonb)) AS amenity
              UNION ALL
              SELECT jsonb_array_elements_text(COALESCE(r.amenities, '[]'::jsonb)) AS amenity
            ) amenities
            ORDER BY amenity
          ),
          ARRAY[]::text[]
        ) AS amenities
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE r.id = ANY($1::uuid[])
      `,
      [roomIds],
    );

    const amenityMap = new Map(result.rows.map((row) => [row.room_id, row.amenities]));

    return candidates.map((c) => ({
      amenities: amenityMap.get(c.roomId) ?? [],
    }));
  }
}
