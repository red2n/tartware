/**
 * DEV DOC
 * Module: schemas/03-bookings/inventory-lock-audits.ts
 * Description: Inventory Lock Audits Schema
 * Table: inventory_lock_audits
 * Category: 03-bookings
 * Primary exports: InventoryLockAuditsSchema, CreateInventoryLockAuditsSchema, UpdateInventoryLockAuditsSchema
 * @table inventory_lock_audits
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * Inventory Lock Audits Schema
 * @table inventory_lock_audits
 * @category 03-bookings
 * @synchronized 2026-01-22
 */

import { z } from "zod";

import { jsonbMetadata, uuid } from "../../shared/base-schemas.js";

export const InventoryLockAuditsSchema = z.object({
	id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	lock_id: uuid,
	tenant_id: uuid,
	action: z.string(),
	performed_by_id: z.string(),
	performed_by_name: z.string(),
	performed_by_email: z.string().nullable().optional(),
	reason: z.string().nullable().optional(),
	metadata: jsonbMetadata,
	created_at: z.date(),
});

export type InventoryLockAudit = z.infer<typeof InventoryLockAuditsSchema>;

export const CreateInventoryLockAuditsSchema = InventoryLockAuditsSchema.omit({
	id: true,
	created_at: true,
});

export type CreateInventoryLockAudit = z.infer<
	typeof CreateInventoryLockAuditsSchema
>;

export const UpdateInventoryLockAuditsSchema = InventoryLockAuditsSchema.partial().extend({
	id: uuid,
});

export type UpdateInventoryLockAudit = z.infer<
	typeof UpdateInventoryLockAuditsSchema
>;
