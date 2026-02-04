/**
 * RoomDetailsHydrator - Enriches candidates with room details.
 */

import { BaseHydrator, type PipelineContext } from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class RoomDetailsHydrator extends BaseHydrator<
  RoomRecommendationQuery,
  RoomCandidate
> {
  readonly name = "room_details";

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
      "Fetching room details",
    );

    const result = await query<{
      room_id: string;
      description: string | null;
      bed_type: string | null;
      square_footage: number | null;
      max_occupancy: number;
    }>(
      `
      SELECT
        r.id AS room_id,
        rt.description,
        rt.bed_type,
        rt.size_sqm AS square_footage,
        rt.max_occupancy
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE r.id = ANY($1::uuid[])
      `,
      [roomIds],
    );

    // Create a map for O(1) lookup
    const detailsMap = new Map(
      result.rows.map((row) => [
        row.room_id,
        {
          description: row.description ?? undefined,
          bedType: row.bed_type ?? undefined,
          squareFootage: row.square_footage ?? undefined,
          maxOccupancy: row.max_occupancy,
        },
      ]),
    );

    // Return in the same order as input candidates
    return candidates.map((c) => detailsMap.get(c.roomId) ?? {});
  }
}
