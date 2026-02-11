/**
 * DEV DOC
 * Module: api/health.ts
 * Purpose: Health check response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

/** Health check response schema for core service. */
export const HealthResponseSchema = z.object({
	status: z.literal("ok"),
	redis: z.object({
		connected: z.boolean(),
		status: z.enum(["healthy", "unavailable"]),
	}),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
