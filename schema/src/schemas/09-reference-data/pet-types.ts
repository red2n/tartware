/**
 * DEV DOC
 * Module: schemas/09-reference-data/pet-types.ts
 * Description: PetTypes Schema - Pet type catalog with charges and policies
 * Table: pet_types
 * Category: 09-reference-data
 * Primary exports: PetTypesSchema, CreatePetTypesSchema, UpdatePetTypesSchema
 * @table pet_types
 * @category 09-reference-data
 * Ownership: Schema package
 */

/**
 * PetTypes Schema
 * Configurable pet type catalog with species, size limits,
 * charges, and policies per property.
 *
 * @table pet_types
 * @category 09-reference-data
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

export const PetTypesSchema = z.object({
	// Primary Key
	pet_type_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid.optional().nullable(),

	// Pet Type
	pet_type_code: z.string().min(1).max(50),
	pet_type_name: z.string().min(1).max(100),
	species: z.string().max(50),

	// Size Restrictions
	size_category: z.string().max(20).optional().nullable(),
	max_weight_kg: z.number().optional().nullable(),
	max_weight_lbs: z.number().optional().nullable(),

	// Charges
	daily_fee: money.default(0),
	one_time_cleaning_fee: money.default(0),
	refundable_deposit: money.default(0),
	currency_code: z.string().max(3).default("USD"),
	charge_code: z.string().max(50).optional().nullable(),

	// Policy
	is_allowed: z.boolean().default(true),
	max_per_room: z.number().int().default(1),
	requires_documentation: z.boolean().default(false),
	requires_crate: z.boolean().default(false),
	allowed_in_lobby: z.boolean().default(false),
	allowed_in_restaurant: z.boolean().default(false),
	weight_limit_enforced: z.boolean().default(true),
	breed_restrictions: z.array(z.string()).optional().nullable(),
	vaccination_required: z.boolean().default(false),

	// Service Animals
	is_service_animal_type: z.boolean().default(false),
	fee_waived_for_service: z.boolean().default(true),

	// Amenities
	pet_amenity_kit: z.boolean().default(false),
	pet_bed_available: z.boolean().default(false),
	pet_sitting_available: z.boolean().default(false),
	dog_walking_available: z.boolean().default(false),
	nearby_vet_info: z.string().optional().nullable(),
	pet_relief_area_description: z.string().optional().nullable(),

	// Status
	is_active: z.boolean().default(true),
	display_order: z.number().int().default(0),

	// Notes
	policy_description: z.string().optional().nullable(),
	internal_notes: z.string().optional().nullable(),

	// Custom Metadata
	metadata: z.record(z.unknown()).optional(),

	// Audit Fields
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
	created_by: uuid.optional().nullable(),
	updated_by: uuid.optional().nullable(),
});

export type PetTypes = z.infer<typeof PetTypesSchema>;

export const CreatePetTypesSchema = PetTypesSchema.omit({
	pet_type_id: true,
	created_at: true,
	updated_at: true,
});

export type CreatePetTypes = z.infer<typeof CreatePetTypesSchema>;

export const UpdatePetTypesSchema = PetTypesSchema.partial().omit({
	pet_type_id: true,
	tenant_id: true,
	created_at: true,
	created_by: true,
});

export type UpdatePetTypes = z.infer<typeof UpdatePetTypesSchema>;
