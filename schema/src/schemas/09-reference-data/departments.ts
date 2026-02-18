/**
 * DEV DOC
 * Module: schemas/09-reference-data/departments.ts
 * Description: Departments Schema — property-level department definitions for
 *   user assignment, staff scheduling, charge routing, and organizational reporting.
 * Table: departments
 * Category: 09-reference-data
 * Primary exports: DepartmentsSchema, CreateDepartmentsSchema, UpdateDepartmentsSchema
 * @table departments
 * @category 09-reference-data
 * Ownership: Schema package
 */

/**
 * Departments Schema
 * Configurable department lookup table for organizational structure.
 *
 * @table departments
 * @category 09-reference-data
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

// ─── Full Row Schema ─────────────────────────────────────────────────────────

export const DepartmentsSchema = z.object({
	department_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional().nullable(),
	department_code: z.string().min(1).max(30),
	department_name: z.string().min(1).max(200),
	description: z.string().optional().nullable(),
	department_type: z.string().max(50).default("OPERATIONAL"),
	parent_department_id: uuid.optional().nullable(),
	cost_center_code: z.string().max(30).optional().nullable(),
	revenue_center_code: z.string().max(30).optional().nullable(),
	head_user_id: uuid.optional().nullable(),
	email: z.string().max(255).optional().nullable(),
	phone_extension: z.string().max(20).optional().nullable(),
	display_order: z.number().int().default(0),
	color_code: z.string().max(7).optional().nullable(),
	icon: z.string().max(50).optional().nullable(),
	is_active: z.boolean().default(true),
	is_system: z.boolean().default(false),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
	created_by: uuid.optional().nullable(),
	updated_by: uuid.optional().nullable(),
	is_deleted: z.boolean().default(false),
	deleted_at: z.coerce.date().optional().nullable(),
	deleted_by: uuid.optional().nullable(),
});

export type Departments = z.infer<typeof DepartmentsSchema>;

// ─── Create Schema ───────────────────────────────────────────────────────────

export const CreateDepartmentsSchema = DepartmentsSchema.omit({
	department_id: true,
	created_at: true,
	updated_at: true,
	deleted_at: true,
	deleted_by: true,
	is_deleted: true,
});

export type CreateDepartments = z.infer<typeof CreateDepartmentsSchema>;

// ─── Update Schema ───────────────────────────────────────────────────────────

export const UpdateDepartmentsSchema = DepartmentsSchema.partial().omit({
	department_id: true,
	tenant_id: true,
	created_at: true,
	created_by: true,
});

export type UpdateDepartments = z.infer<typeof UpdateDepartmentsSchema>;
