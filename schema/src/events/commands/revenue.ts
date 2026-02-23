/**
 * DEV DOC
 * Module: events/commands/revenue.ts
 * Description: Revenue command schemas for forecast computation and revenue management
 * Primary exports: RevenueForecastComputeCommandSchema
 * @category commands
 * Ownership: Schema package
 */

import { z } from "zod";

/**
 * Compute revenue forecasts for a property.
 * Analyzes historical reservation data (occupancy, ADR, room revenue)
 * over a training window and projects forward across multiple scenarios.
 *
 * @category commands
 */
export const RevenueForecastComputeCommandSchema = z.object({
	property_id: z.string().uuid(),
	forecast_period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
	horizon_days: z.number().int().min(1).max(365).default(30),
	training_days: z.number().int().min(30).max(730).default(90),
	scenarios: z
		.array(z.enum(["base", "optimistic", "pessimistic", "conservative", "aggressive"]))
		.default(["base", "optimistic", "pessimistic"]),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type RevenueForecastComputeCommand = z.infer<
	typeof RevenueForecastComputeCommandSchema
>;
