/**
 * DEV DOC
 * Module: schemas/01-core/command-idempotency.ts
 * Description: Command Idempotency Schema
 * Table: command_idempotency
 * Category: 01-core
 * Primary exports: CommandIdempotencySchema
 * @table command_idempotency
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * Command Idempotency Schema
 *
 * Consumer-side dedup table. Prevents double-processing of
 * retried Kafka command messages.
 *
 * @table command_idempotency
 * @category 01-core
 * @synchronized 2026-02-09
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete CommandIdempotency schema — mirrors the `command_idempotency` table.
 */
export const CommandIdempotencySchema = z.object({
	tenant_id: uuid,
	idempotency_key: z.string().max(200),
	command_name: z.string().max(150),
	command_id: uuid.optional(),
	processed_at: z.coerce.date(),
	created_at: z.coerce.date(),
});

export type CommandIdempotency = z.infer<typeof CommandIdempotencySchema>;
