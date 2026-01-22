/**
 * DEV DOC
 * Module: schemas/06-integrations/demand-scenarios.ts
 * Description: DemandScenarios Schema
 * Table: demand_scenarios
 * Category: 06-integrations
 * Primary exports: DemandScenariosSchema, CreateDemandScenariosSchema, UpdateDemandScenariosSchema
 * @table demand_scenarios
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * DemandScenarios Schema
 * @table demand_scenarios
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete DemandScenarios schema
 */
export const DemandScenariosSchema = z.object({
	scenario_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	scenario_name: z.string(),
	scenario_type: z.string().optional(),
	description: z.string().optional(),
	start_date: z.coerce.date(),
	end_date: z.coerce.date(),
	demand_adjustment_percentage: money.optional(),
	price_elasticity: money.optional(),
	event_assumptions: z.array(z.string()).optional(),
	economic_assumptions: z.string().optional(),
	competitor_assumptions: z.string().optional(),
	predicted_total_rooms_sold: z.number().int().optional(),
	predicted_total_revenue: money.optional(),
	predicted_average_occupancy: money.optional(),
	predicted_average_adr: money.optional(),
	probability: money.optional(),
	is_active: z.boolean().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type DemandScenarios = z.infer<typeof DemandScenariosSchema>;

/**
 * Schema for creating a new demand scenarios
 */
export const CreateDemandScenariosSchema = DemandScenariosSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateDemandScenarios = z.infer<typeof CreateDemandScenariosSchema>;

/**
 * Schema for updating a demand scenarios
 */
export const UpdateDemandScenariosSchema = DemandScenariosSchema.partial();

export type UpdateDemandScenarios = z.infer<typeof UpdateDemandScenariosSchema>;
