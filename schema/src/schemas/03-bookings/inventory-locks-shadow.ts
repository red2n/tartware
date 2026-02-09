/**
 * DEV DOC
 * Module: schemas/03-bookings/inventory-locks-shadow.ts
 * Description: Inventory Locks Shadow Schema
 * Table: inventory_locks_shadow
 * Category: 03-bookings
 * Primary exports: InventoryLocksShadowSchema
 * @table inventory_locks_shadow
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * Inventory Locks Shadow Schema
 *
 * Shadow inventory locks used by the availability-guard-service
 * to track room/room-type holds for reservations.
 *
 * @table inventory_locks_shadow
 * @category 03-bookings
 * @synchronized 2026-02-09
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Lock status — inline CHECK constraint, not a DB enum.
 */
export const InventoryLockStatusEnum = z.enum(["ACTIVE", "RELEASED"]);
export type InventoryLockStatus = z.infer<typeof InventoryLockStatusEnum>;

/**
 * Complete InventoryLocksShadow schema — mirrors the `inventory_locks_shadow` table.
 */
export const InventoryLocksShadowSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	reservation_id: uuid.optional(),
	room_type_id: uuid,
	room_id: uuid.optional(),
	stay_start: z.coerce.date(),
	stay_end: z.coerce.date(),
	reason: z.string().max(100),
	correlation_id: z.string().max(255).optional(),
	expires_at: z.coerce.date().optional(),
	ttl_seconds: z.number().int().nonnegative().optional(),
	metadata: z.record(z.unknown()).default({}),
	status: InventoryLockStatusEnum.default("ACTIVE"),
	release_reason: z.string().optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date(),
});

export type InventoryLocksShadow = z.infer<typeof InventoryLocksShadowSchema>;
