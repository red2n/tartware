/**
 * DEV DOC
 * Module: schemas/04-financial/general-ledger-batches.ts
 * Description: GeneralLedgerBatches Schema
 * Table: general_ledger_batches
 * Category: 04-financial
 * Primary exports: GeneralLedgerBatchesSchema, CreateGeneralLedgerBatchesSchema, UpdateGeneralLedgerBatchesSchema
 * @table general_ledger_batches
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * GeneralLedgerBatches Schema
 * @table general_ledger_batches
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete GeneralLedgerBatches schema
 */
export const GeneralLedgerBatchesSchema = z.object({
	gl_batch_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	batch_number: z.string(),
	batch_date: z.coerce.date(),
	accounting_period: z.string(),
	source_module: z.string(),
	currency: z.string().optional(),
	debit_total: money,
	credit_total: money,
	entry_count: z.number().int(),
	variance: money.optional(),
	batch_status: z.string(),
	exported_at: z.coerce.date().optional(),
	exported_by: uuid.optional(),
	export_format: z.string().optional(),
	export_file_url: z.string().optional(),
	created_at: z.coerce.date(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type GeneralLedgerBatches = z.infer<typeof GeneralLedgerBatchesSchema>;

/**
 * Schema for creating a new general ledger batches
 */
export const CreateGeneralLedgerBatchesSchema = GeneralLedgerBatchesSchema.omit(
	{
		// TODO: Add fields to omit for creation
	},
);

export type CreateGeneralLedgerBatches = z.infer<
	typeof CreateGeneralLedgerBatchesSchema
>;

/**
 * Schema for updating a general ledger batches
 */
export const UpdateGeneralLedgerBatchesSchema =
	GeneralLedgerBatchesSchema.partial();

export type UpdateGeneralLedgerBatches = z.infer<
	typeof UpdateGeneralLedgerBatchesSchema
>;
