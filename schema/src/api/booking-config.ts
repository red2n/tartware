/**
 * DEV DOC
 * Module: api/booking-config.ts
 * Purpose: Booking configuration API schemas (metasearch, promo codes)
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

// =====================================================
// METASEARCH CLICK PERFORMANCE
// =====================================================

/**
 * Metasearch click performance item schema for API responses.
 */
export const ClickPerformanceItemSchema = z.object({
	config_id: uuid,
	platform: z.string(),
	total_clicks: z.number(),
	total_cost: z.number(),
	total_conversions: z.number(),
	total_conversion_value: z.number(),
	conversion_rate_pct: z.number(),
	roas: z.number(),
});

export type ClickPerformanceItem = z.infer<typeof ClickPerformanceItemSchema>;
