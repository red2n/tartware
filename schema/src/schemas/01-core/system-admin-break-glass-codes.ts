/**
 * DEV DOC
 * Module: schemas/01-core/system-admin-break-glass-codes.ts
 * Description: System Admin Break Glass Codes Schema
 * Table: system_admin_break_glass_codes
 * Category: 01-core
 * Primary exports: SystemAdminBreakGlassCodeSchema, CreateSystemAdminBreakGlassCodeSchema, UpdateSystemAdminBreakGlassCodeSchema
 * @table system_admin_break_glass_codes
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * System Admin Break Glass Codes Schema
 * @table system_admin_break_glass_codes
 * @category 01-core
 * @synchronized 2025-12-26
 */

import { z } from "zod";

import { jsonbMetadata, uuid } from "../../shared/base-schemas.js";

export const SystemAdminBreakGlassCodeSchema = z.object({
	id: uuid,
	admin_id: uuid,
	code_hash: z.string().min(20),
	label: z.string().max(100).nullable().optional(),
	created_at: z.coerce.date(),
	expires_at: z.coerce.date().nullable().optional(),
	used_at: z.coerce.date().nullable().optional(),
	used_session_id: z.string().nullable().optional(),
	metadata: jsonbMetadata,
});

export type SystemAdminBreakGlassCode = z.infer<typeof SystemAdminBreakGlassCodeSchema>;

export const CreateSystemAdminBreakGlassCodeSchema =
	SystemAdminBreakGlassCodeSchema.omit({
		id: true,
		created_at: true,
		used_at: true,
		used_session_id: true,
	});
export type CreateSystemAdminBreakGlassCode = z.infer<
	typeof CreateSystemAdminBreakGlassCodeSchema
>;

export const UpdateSystemAdminBreakGlassCodeSchema =
	SystemAdminBreakGlassCodeSchema.partial().extend({
		id: uuid,
	});
export type UpdateSystemAdminBreakGlassCode = z.infer<
	typeof UpdateSystemAdminBreakGlassCodeSchema
>;
