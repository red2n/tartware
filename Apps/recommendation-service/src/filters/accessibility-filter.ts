/**
 * AccessibilityFilter - Ensures rooms meet accessibility requirements.
 *
 * Only applies if the guest has accessibility needs specified.
 */

import { BaseFilter, type PipelineContext, type FilterResult } from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class AccessibilityFilter extends BaseFilter<
  RoomRecommendationQuery,
  RoomCandidate
> {
  readonly name = "accessibility";

  /**
   * Only enable if guest has accessibility requirements.
   */
  enable(queryParams: RoomRecommendationQuery): boolean {
    return (
      queryParams.guestPreferences?.accessibilityNeeds !== undefined &&
      queryParams.guestPreferences.accessibilityNeeds.length > 0
    );
  }

  async filter(
    queryParams: RoomRecommendationQuery,
    candidates: RoomCandidate[],
    context: PipelineContext,
  ): Promise<FilterResult<RoomCandidate>> {
    if (candidates.length === 0) {
      return { kept: [], removed: [] };
    }

    const requiredFeatures = queryParams.guestPreferences!.accessibilityNeeds!;
    const roomIds = candidates.map((c) => c.roomId);

    context.logger.debug(
      { requiredFeatures, candidateCount: candidates.length },
      "Checking accessibility features",
    );

    // Fetch rooms that have the required accessibility features
    const result = await query<{ room_id: string }>(
      `
      SELECT DISTINCT r.room_id
      FROM rooms r
      JOIN room_amenities ra ON r.room_id = ra.room_id
      JOIN amenities a ON ra.amenity_id = a.amenity_id
      WHERE r.room_id = ANY($1::uuid[])
        AND a.category = 'accessibility'
        AND a.name = ANY($2::text[])
      GROUP BY r.room_id
      HAVING COUNT(DISTINCT a.name) >= $3
      `,
      [roomIds, requiredFeatures, requiredFeatures.length],
    );

    const accessibleRoomIds = new Set(result.rows.map((r) => r.room_id));

    const kept: RoomCandidate[] = [];
    const removed: RoomCandidate[] = [];

    for (const candidate of candidates) {
      if (accessibleRoomIds.has(candidate.roomId)) {
        kept.push(candidate);
      } else {
        removed.push(candidate);
      }
    }

    context.logger.debug(
      { kept: kept.length, removed: removed.length },
      "Accessibility filter complete",
    );

    return { kept, removed };
  }
}
