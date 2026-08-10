/**
 * DEV DOC
 * Module: schemas/02-inventory/travel-agents.ts
 * Description: TravelAgents Schema
 * Table: travel_agents
 * Category: 02-inventory
 * Primary exports: TravelAgentsSchema, CreateTravelAgentsSchema, UpdateTravelAgentsSchema
 * @table travel_agents
 * @category 02-inventory
 * Ownership: Schema package
 */

/**
 * TravelAgents Schema
 * @table travel_agents
 * @category 02-inventory
 * @synchronized 2026-08-10
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete TravelAgents schema
 *
 * An individual agent booking on behalf of an agency. Commission rules,
 * statements and settlement are all keyed on the agency (`company_id`), which
 * is why every commission lookup resolves agent → company; the agent row exists
 * so a booking can be attributed to the person who made it.
 */
export const TravelAgentsSchema = z.object({
	agent_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	/** Agency the agent books for; the settlement party for any commission. */
	company_id: uuid.optional(),
	agent_code: z.string().max(50),
	agent_name: z.string().max(255),
	agent_email: z.string().max(255).optional(),
	agent_phone: z.string().max(50).optional(),
	/** IATA identifier used for commission settlement. */
	iata_number: z.string().max(20).optional(),
	consortium: z.string().max(100).optional(),
	default_commission_rate: z.number().optional(),
	commission_currency: z.string().length(3).optional(),
	is_active: z.boolean().optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	version: z.number().int().optional(),
});

export type TravelAgents = z.infer<typeof TravelAgentsSchema>;

/**
 * Schema for creating a new travel agent
 */
export const CreateTravelAgentsSchema = TravelAgentsSchema.omit({
	agent_id: true,
	created_at: true,
	updated_at: true,
	version: true,
});

export type CreateTravelAgents = z.infer<typeof CreateTravelAgentsSchema>;

/**
 * Schema for updating a travel agent
 */
export const UpdateTravelAgentsSchema = TravelAgentsSchema.partial();

export type UpdateTravelAgents = z.infer<typeof UpdateTravelAgentsSchema>;
