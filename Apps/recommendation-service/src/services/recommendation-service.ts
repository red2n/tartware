/**
 * Recommendation service - business logic for room recommendations.
 */

import type { CandidatePipeline } from "@tartware/candidate-pipeline";
import { randomUUID } from "node:crypto";

import { config } from "../config.js";
import { appLogger } from "../lib/logger.js";
import {
  candidatesProcessedHistogram,
  recommendationDurationHistogram,
  recommendationRequestsTotal,
} from "../lib/metrics.js";
import { buildRecommendationPipeline } from "../pipeline/index.js";
import type {
  RoomCandidate,
  RoomRecommendation,
  RoomRecommendationQuery,
  RoomRecommendationResponse,
} from "../types.js";

let pipeline: CandidatePipeline<RoomRecommendationQuery, RoomCandidate> | null =
  null;

/**
 * Initialize the recommendation pipeline.
 */
export function initializePipeline(): void {
  pipeline = buildRecommendationPipeline(appLogger);
  appLogger.info("Recommendation pipeline initialized");
}

/**
 * Get room recommendations for a guest.
 */
export async function getRecommendations(params: {
  tenantId: string;
  propertyId: string;
  guestId?: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  limit?: number;
}): Promise<RoomRecommendationResponse> {
  if (!pipeline) {
    throw new Error("Pipeline not initialized");
  }

  const requestId = randomUUID();
  const query: RoomRecommendationQuery = {
    requestId,
    tenantId: params.tenantId,
    propertyId: params.propertyId,
    guestId: params.guestId,
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    adults: params.adults,
    children: params.children,
    limit: Math.min(
      params.limit ?? config.recommendation.defaultResultSize,
      config.recommendation.maxResultSize,
    ),
  };

  const startTime = performance.now();
  const endTimer = recommendationDurationHistogram.startTimer({ stage: "total" });

  try {
    const result = await pipeline.execute(query);

    // Record metrics
    recommendationRequestsTotal.inc({ status: "success", source: "available" });
    candidatesProcessedHistogram.observe(
      { stage: "sourced" },
      result.metrics.candidateCounts.sourced,
    );
    candidatesProcessedHistogram.observe(
      { stage: "selected" },
      result.metrics.candidateCounts.selected,
    );

    const recommendations = result.selectedCandidates.map(
      candidateToRecommendation,
    );

    const executionTimeMs = performance.now() - startTime;
    endTimer();

    return {
      requestId,
      recommendations,
      totalCandidates: result.metrics.candidateCounts.sourced,
      executionTimeMs,
    };
  } catch (error) {
    recommendationRequestsTotal.inc({ status: "error", source: "available" });
    endTimer();
    throw error;
  }
}

/**
 * Convert a RoomCandidate to a RoomRecommendation response.
 */
function candidateToRecommendation(
  candidate: RoomCandidate,
): RoomRecommendation {
  // Normalize score to 0-1 range for display
  const maxPossibleScore = 1.0; // Sum of all scorer weights
  const normalizedScore = Math.min(
    1,
    Math.max(0, (candidate.score ?? 0) / maxPossibleScore),
  );

  return {
    roomId: candidate.roomId,
    roomTypeId: candidate.roomTypeId,
    roomTypeName: candidate.roomTypeName,
    roomNumber: candidate.roomNumber,
    floor: candidate.floor,
    viewType: candidate.viewType,
    baseRate: candidate.baseRate,
    dynamicRate: candidate.dynamicRate,
    totalPrice: candidate.totalPrice,
    amenities: candidate.amenities,
    description: candidate.description,
    photos: candidate.photos,
    maxOccupancy: candidate.maxOccupancy,
    bedType: candidate.bedType,
    squareFootage: candidate.squareFootage,
    isUpgrade: candidate.isUpgrade,
    upgradeDiscount: candidate.upgradeDiscount,
    relevanceScore: normalizedScore,
    source: candidate.source,
  };
}

interface RankedRoom {
  roomId: string;
  rank: number;
  relevanceScore: number;
  reasons: string[];
}

interface RankRoomsResponse {
  requestId: string;
  rankedRooms: RankedRoom[];
  executionTimeMs: number;
}

/**
 * Rank a list of room IDs for a guest.
 * This is used when you already have available rooms and want personalized ordering.
 */
export async function rankRooms(params: {
  tenantId: string;
  propertyId: string;
  guestId?: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  roomIds: string[];
}): Promise<RankRoomsResponse> {
  const requestId = randomUUID();
  const startTime = performance.now();

  // For now, use a simplified scoring approach
  // In production, this would use the full pipeline with the provided roomIds as candidates
  const rankedRooms: RankedRoom[] = [];

  // Query room details and guest preferences to generate rankings
  const { pool } = await import("../lib/db.js");

  // Get guest preferences if guestId provided
  let guestPreferences: { roomType?: string; amenities?: string[]; floor?: string } = {};
  if (params.guestId) {
    try {
      const prefResult = await pool.query(
        `SELECT
           preferences->>'roomType' AS preferred_room_type,
           preferences->>'floor' AS preferred_floor,
           COALESCE(
             ARRAY(
               SELECT jsonb_array_elements_text(preferences->'specialRequests')
             ),
             ARRAY[]::text[]
           ) AS preferred_amenities
         FROM guests
         WHERE id = $1 AND tenant_id = $2`,
        [params.guestId, params.tenantId],
      );
      if (prefResult.rows.length > 0) {
        const row = prefResult.rows[0] as {
          preferred_room_type?: string;
          preferred_amenities?: string[];
          preferred_floor?: string;
        };
        guestPreferences = {
          roomType: row.preferred_room_type,
          amenities: row.preferred_amenities,
          floor: row.preferred_floor,
        };
      }
    } catch {
      // Guest preferences not available, continue without them
    }
  }

  // Get room details for scoring
  const roomDetails = await pool.query(
    `SELECT r.id, r.room_number, r.floor, r.room_type_id,
            rt.type_name as room_type_name, rt.base_price as base_rate, rt.max_occupancy
     FROM rooms r
     JOIN room_types rt ON r.room_type_id = rt.id
     WHERE r.id = ANY($1) AND r.tenant_id = $2`,
    [params.roomIds, params.tenantId],
  );

  const roomMap = new Map<string, {
    id: string;
    room_number: string;
    floor: string | null;
    room_type_id: string;
    room_type_name: string;
    base_rate: number;
    max_occupancy: number;
  }>();
  for (const row of roomDetails.rows) {
    const r = row as {
      id: string;
      room_number: string;
      floor: string | null;
      room_type_id: string;
      room_type_name: string;
      base_rate: number;
      max_occupancy: number;
    };
    roomMap.set(r.id, r);
  }

  // Score each room
  for (const roomId of params.roomIds) {
    const room = roomMap.get(roomId);
    if (!room) {
      // Room not found, give it lowest score
      rankedRooms.push({
        roomId,
        rank: 0,
        relevanceScore: 0,
        reasons: ["Room not found in database"],
      });
      continue;
    }

    let score = 0.5; // Base score
    const reasons: string[] = [];

    // Occupancy fit (0-0.2)
    const totalGuests = params.adults + params.children;
    if (room.max_occupancy >= totalGuests) {
      const occupancyFit = 1 - Math.abs(room.max_occupancy - totalGuests) / 10;
      score += 0.2 * occupancyFit;
      if (room.max_occupancy === totalGuests) {
        reasons.push("Perfect fit for your group size");
      } else if (room.max_occupancy > totalGuests) {
        reasons.push("Extra space for comfort");
      }
    }

    // Guest preference match (0-0.3)
    if (guestPreferences.roomType && room.room_type_name.toLowerCase().includes(guestPreferences.roomType.toLowerCase())) {
      score += 0.15;
      reasons.push("Matches your preferred room type");
    }

    if (guestPreferences.floor) {
      const preferredFloor = guestPreferences.floor.toLowerCase();
      const floorNumber = room.floor ? Number.parseInt(room.floor, 10) : Number.NaN;
      const isHighFloor = !Number.isNaN(floorNumber) && floorNumber >= 5;
      const isLowFloor = !Number.isNaN(floorNumber) && floorNumber <= 2;
      if ((preferredFloor === "high" && isHighFloor) || (preferredFloor === "low" && isLowFloor)) {
        score += 0.15;
        reasons.push(`${isHighFloor ? "High" : "Low"} floor as preferred`);
      }
    }

    // If no specific reasons, add a generic one
    if (reasons.length === 0) {
      reasons.push("Available for your dates");
    }

    rankedRooms.push({
      roomId,
      rank: 0, // Will be set after sorting
      relevanceScore: Math.min(1, Math.max(0, score)),
      reasons,
    });
  }

  // Sort by score descending and assign ranks
  rankedRooms.sort((a, b) => b.relevanceScore - a.relevanceScore);
  rankedRooms.forEach((room, index) => {
    room.rank = index + 1;
  });

  const executionTimeMs = performance.now() - startTime;

  return {
    requestId,
    rankedRooms,
    executionTimeMs,
  };
}
