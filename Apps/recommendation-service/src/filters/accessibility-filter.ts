/**
 * AccessibilityFilter - Ensures rooms meet accessibility requirements.
 *
 * Only applies if the guest has accessibility needs specified.
 */

import { BaseFilter, type FilterResult, type PipelineContext } from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class AccessibilityFilter extends BaseFilter<RoomRecommendationQuery, RoomCandidate> {
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
    const result = await query<{ id: string }>(
      `
      SELECT r.id
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE r.id = ANY($1::uuid[])
        AND (
          COALESCE((r.features->>'accessibility')::boolean, false)
          OR COALESCE((rt.features->>'accessibility')::boolean, false)
        )
      `,
      [roomIds],
    );

    const accessibleRoomIds = new Set(result.rows.map((r) => r.id));

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
