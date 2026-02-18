/**
 * DEV DOC
 * Module: schemas/01-core/field-configurations.ts
 * Description: FieldConfigurations Schema
 * Table: field_configurations
 * Category: 01-core
 * Primary exports: FieldConfigurationsSchema, CreateFieldConfigurationsSchema, UpdateFieldConfigurationsSchema
 * @table field_configurations
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * FieldConfigurations Schema — dynamic field visibility, validation,
 * and ordering for configurable entity forms (profiles, groups, AR, etc.).
 * @table field_configurations
 * @category 01-core
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

const entityTypeEnum = z.enum([
	"GUEST_PROFILE",
	"GROUP_BOOKING",
	"ACCOUNTS_RECEIVABLE",
	"RESERVATION",
	"COMPANY",
]);

const validationTypeEnum = z.enum([
	"REGEX",
	"MIN_LENGTH",
	"MAX_LENGTH",
	"ENUM",
	"DATE_RANGE",
	"NUMERIC_RANGE",
]);

const customFieldDataTypeEnum = z.enum([
	"TEXT",
	"NUMBER",
	"DATE",
	"BOOLEAN",
	"SELECT",
	"MULTI_SELECT",
]);

/**
 * Complete FieldConfigurations schema
 */
export const FieldConfigurationsSchema = z.object({
	field_config_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),

	// Entity identification
	entity_type: entityTypeEnum,
	field_name: z.string().max(100),
	field_label: z.string().max(200).optional(),

	// Visibility & behavior
	is_visible: z.boolean().optional(),
	is_required: z.boolean().optional(),
	is_read_only: z.boolean().optional(),
	is_searchable: z.boolean().optional(),

	// Ordering
	display_order: z.number().int().optional(),
	section_name: z.string().max(100).optional(),

	// Validation
	validation_type: validationTypeEnum.optional(),
	validation_rule: z.string().optional(),
	validation_message: z.string().max(500).optional(),

	// Default value
	default_value: z.string().optional(),

	// Custom fields
	is_custom_field: z.boolean().optional(),
	custom_field_data_type: customFieldDataTypeEnum.optional(),
	custom_field_options: z.record(z.unknown()).optional(),

	// Dependency rules
	depends_on_field: z.string().max(100).optional(),
	depends_on_value: z.string().optional(),

	// Status
	is_active: z.boolean().optional(),

	// Audit
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),

	// Soft delete
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type FieldConfigurations = z.infer<typeof FieldConfigurationsSchema>;

/**
 * Schema for creating a field configuration.
 * Omits auto-generated fields.
 */
export const CreateFieldConfigurationsSchema = FieldConfigurationsSchema.omit({
	field_config_id: true,
	created_at: true,
	updated_at: true,
	created_by: true,
	updated_by: true,
	is_deleted: true,
	deleted_at: true,
	deleted_by: true,
});

export type CreateFieldConfigurations = z.infer<
	typeof CreateFieldConfigurationsSchema
>;

/**
 * Schema for updating a field configuration.
 * All fields optional; immutable keys excluded.
 */
export const UpdateFieldConfigurationsSchema = FieldConfigurationsSchema.omit({
	field_config_id: true,
	tenant_id: true,
	created_at: true,
	created_by: true,
}).partial();

export type UpdateFieldConfigurations = z.infer<
	typeof UpdateFieldConfigurationsSchema
>;
