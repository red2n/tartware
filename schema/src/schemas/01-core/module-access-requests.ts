/**
 * DEV DOC
 * Module: schemas/01-core/module-access-requests.ts
 * Description: ModuleAccessRequests Schema
 * Table: module_access_requests
 * Category: 01-core
 * Primary exports: ModuleAccessRequestsSchema, CreateModuleAccessRequestsSchema, UpdateModuleAccessRequestsSchema
 * @table module_access_requests
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * ModuleAccessRequests Schema
 * @table module_access_requests
 * @category 01-core
 * @synchronized 2026-08-10
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete ModuleAccessRequests schema
 *
 * A staff member hits a screen whose module the tenant has not switched on and
 * raises a request here; an ADMIN approves (enabling the module) or rejects.
 *
 * This is the stored row. The resolved shape the UI renders — camelCase, with
 * moduleName/requestedByName/reviewedByName joined in — is ModuleAccessRequest
 * in api/tenants.ts, and is deliberately a separate type.
 */
export const ModuleAccessRequestsSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	/** Property the requester was working in; context only, not a scope. */
	property_id: uuid.optional(),
	/** Module registry id the requester needs (e.g. analytics-bi). */
	module_id: z.string().max(100),
	requested_by: uuid,
	/** Screen key the requester was blocked on, for context in the review panel. */
	requested_screen: z.string().max(100).optional(),
	reason: z.string().optional(),
	/** Mirrors the table's module_access_requests_status_check constraint. */
	status: z.enum(["pending", "approved", "rejected", "cancelled"]),
	reviewed_by: uuid.optional(),
	reviewed_at: z.coerce.date().optional(),
	/** Admin explanation shown back to the requester, especially on a rejection. */
	review_notes: z.string().optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	version: z.number().int().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
});

export type ModuleAccessRequests = z.infer<typeof ModuleAccessRequestsSchema>;

/**
 * Schema for creating a new module access request
 *
 * The decision fields are omitted rather than optional: a request is created
 * pending and only ever reaches a verdict through the review path.
 */
export const CreateModuleAccessRequestsSchema = ModuleAccessRequestsSchema.omit(
	{
		id: true,
		status: true,
		reviewed_by: true,
		reviewed_at: true,
		review_notes: true,
		created_at: true,
		updated_at: true,
		version: true,
	},
);

export type CreateModuleAccessRequests = z.infer<
	typeof CreateModuleAccessRequestsSchema
>;

/**
 * Schema for updating a module access request
 */
export const UpdateModuleAccessRequestsSchema =
	ModuleAccessRequestsSchema.partial();

export type UpdateModuleAccessRequests = z.infer<
	typeof UpdateModuleAccessRequestsSchema
>;
