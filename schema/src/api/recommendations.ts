/**
 * DEV DOC
 * Module: api/recommendations.ts
 * Purpose: Recommendation engine API schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

// -----------------------------------------------------------------------------
// Query
// -----------------------------------------------------------------------------

/** Query schema for getting room recommendations. */
export const RecommendationQuerySchema = z.object({
	propertyId: uuid,
	guestId: uuid.optional(),
	checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	adults: z.coerce.number().int().min(1).max(10).default(1),
	children: z.coerce.number().int().min(0).max(10).default(0),
	limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type RecommendationQuery = z.infer<typeof RecommendationQuerySchema>;

// -----------------------------------------------------------------------------
// Rank Rooms
// -----------------------------------------------------------------------------

/** Body schema for ranking a list of room IDs. */
export const RankRoomsBodySchema = z.object({
	propertyId: uuid,
	guestId: uuid.optional(),
	checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	adults: z.number().int().min(1).max(10).default(1),
	children: z.number().int().min(0).max(10).default(0),
	roomIds: z.array(uuid).min(1).max(100),
});

export type RankRoomsBody = z.infer<typeof RankRoomsBodySchema>;
