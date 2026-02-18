/**
 * DEV DOC
 * Module: schemas/09-reference-data/pet-registrations.ts
 * Description: PetRegistrations Schema - Per-reservation pet tracking
 * Table: pet_registrations
 * Category: 09-reference-data
 * Primary exports: PetRegistrationsSchema, CreatePetRegistrationsSchema, UpdatePetRegistrationsSchema
 * @table pet_registrations
 * @category 09-reference-data
 * Ownership: Schema package
 */

/**
 * PetRegistrations Schema
 * Tracks individual pets associated with guest reservations
 * including documentation and charges.
 *
 * @table pet_registrations
 * @category 09-reference-data
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

export const PetRegistrationsSchema = z.object({
	// Primary Key
	registration_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid,

	// Links
	reservation_id: uuid,
	guest_id: uuid,
	pet_type_id: uuid,
	room_id: uuid.optional().nullable(),

	// Pet Details
	pet_name: z.string().min(1).max(100),
	breed: z.string().max(100).optional().nullable(),
	color: z.string().max(50).optional().nullable(),
	weight_kg: z.number().optional().nullable(),
	age_years: z.number().int().optional().nullable(),
	is_service_animal: z.boolean().default(false),

	// Documentation
	vaccination_verified: z.boolean().default(false),
	vaccination_expiry: z.coerce.date().optional().nullable(),
	health_certificate_url: z.string().max(500).optional().nullable(),
	liability_waiver_signed: z.boolean().default(false),
	liability_waiver_date: z.coerce.date().optional().nullable(),

	// Financial
	deposit_collected: money.default(0),
	deposit_refunded: money.default(0),
	fees_charged: money.default(0),
	damage_charges: money.default(0),
	currency_code: z.string().max(3).default("USD"),

	// Check-in/out
	checked_in_at: z.coerce.date().optional().nullable(),
	checked_out_at: z.coerce.date().optional().nullable(),

	// Status
	registration_status: z.string().max(20).default("ACTIVE"),

	// Notes
	special_instructions: z.string().optional().nullable(),
	incident_notes: z.string().optional().nullable(),
	internal_notes: z.string().optional().nullable(),

	// Custom Metadata
	metadata: z.record(z.unknown()).optional(),

	// Audit Fields
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
	created_by: uuid.optional().nullable(),
	updated_by: uuid.optional().nullable(),

	// Soft Delete
	is_deleted: z.boolean().default(false),
	deleted_at: z.coerce.date().optional().nullable(),
	deleted_by: uuid.optional().nullable(),
});

export type PetRegistrations = z.infer<typeof PetRegistrationsSchema>;

export const CreatePetRegistrationsSchema = PetRegistrationsSchema.omit({
	registration_id: true,
	created_at: true,
	updated_at: true,
	deleted_at: true,
	deleted_by: true,
	is_deleted: true,
	checked_in_at: true,
	checked_out_at: true,
});

export type CreatePetRegistrations = z.infer<
	typeof CreatePetRegistrationsSchema
>;

export const UpdatePetRegistrationsSchema =
	PetRegistrationsSchema.partial().omit({
		registration_id: true,
		tenant_id: true,
		property_id: true,
		reservation_id: true,
		created_at: true,
		created_by: true,
	});

export type UpdatePetRegistrations = z.infer<
	typeof UpdatePetRegistrationsSchema
>;
