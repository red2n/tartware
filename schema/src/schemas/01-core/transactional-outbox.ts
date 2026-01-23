/**
 * DEV DOC
 * Module: schemas/01-core/transactional-outbox.ts
 * Description: Transactional Outbox Schema
 * Table: transactional_outbox
 * Category: 01-core
 * Primary exports: TransactionalOutboxSchema, CreateTransactionalOutboxSchema, UpdateTransactionalOutboxSchema
 * @table transactional_outbox
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * Transactional Outbox Schema
 * @table transactional_outbox
 * @category 01-core
 * @synchronized 2025-12-15 (generated manually for reliability rollout)
 *
 * Purpose: Durable event store feeding Kafka with idempotent delivery for K8s/K3s jobs
 */

import { z } from "zod";

import { jsonbMetadata, uuid } from "../../shared/base-schemas.js";
import { OutboxStatusEnum } from "../../shared/enums.js";

export const TransactionalOutboxSchema = z.object({
	id: z.bigint(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	event_id: uuid,
	tenant_id: uuid,
	aggregate_id: uuid,
	aggregate_type: z.string(),
	event_type: z.string(),
	payload: z.record(z.unknown()),
	headers: z.record(z.unknown()).default({}),
	status: OutboxStatusEnum,
	available_at: z.date(),
	locked_at: z.date().nullable().optional(),
	locked_by: z.string().nullable().optional(),
	retry_count: z.number().int().nonnegative(),
	priority: z.number().int(),
	correlation_id: uuid.optional(),
	partition_key: z.string().optional(),
	last_error: z.string().nullable().optional(),
	delivered_at: z.date().nullable().optional(),
	metadata: jsonbMetadata,
	created_at: z.date(),
	updated_at: z.date().optional(),
});

export type TransactionalOutbox = z.infer<typeof TransactionalOutboxSchema>;

export const CreateTransactionalOutboxSchema = TransactionalOutboxSchema.omit({
	id: true,
	locked_at: true,
	locked_by: true,
	delivered_at: true,
	created_at: true,
	updated_at: true,
});
export type CreateTransactionalOutbox = z.infer<
	typeof CreateTransactionalOutboxSchema
>;

export const UpdateTransactionalOutboxSchema = TransactionalOutboxSchema.partial().extend(
	{
		id: z.bigint(),
	},
);
export type UpdateTransactionalOutbox = z.infer<
	typeof UpdateTransactionalOutboxSchema
>;
