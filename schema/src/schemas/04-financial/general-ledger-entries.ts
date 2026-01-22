/**
 * DEV DOC
 * Module: schemas/04-financial/general-ledger-entries.ts
 * Description: GeneralLedgerEntries Schema
 * Table: general_ledger_entries
 * Category: 04-financial
 * Primary exports: GeneralLedgerEntriesSchema, CreateGeneralLedgerEntriesSchema, UpdateGeneralLedgerEntriesSchema
 * @table general_ledger_entries
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * GeneralLedgerEntries Schema
 * @table general_ledger_entries
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete GeneralLedgerEntries schema
 */
export const GeneralLedgerEntriesSchema = z.object({
	gl_entry_id: uuid,
	gl_batch_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	folio_id: uuid.optional(),
	reservation_id: uuid.optional(),
	department_code: z.string().optional(),
	posting_date: z.coerce.date(),
	gl_account_code: z.string(),
	cost_center: z.string().optional(),
	usali_category: z.string().optional(),
	description: z.string().optional(),
	debit_amount: money.optional(),
	credit_amount: money.optional(),
	currency: z.string().optional(),
	exchange_rate: money.optional(),
	base_currency: z.string().optional(),
	base_amount: money.optional(),
	source_table: z.string().optional(),
	source_id: uuid.optional(),
	reference_number: z.string().optional(),
	status: z.string(),
	posted_at: z.coerce.date().optional(),
	posted_by: uuid.optional(),
	created_at: z.coerce.date(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type GeneralLedgerEntries = z.infer<typeof GeneralLedgerEntriesSchema>;

/**
 * Schema for creating a new general ledger entries
 */
export const CreateGeneralLedgerEntriesSchema = GeneralLedgerEntriesSchema.omit(
	{
		// TODO: Add fields to omit for creation
	},
);

export type CreateGeneralLedgerEntries = z.infer<
	typeof CreateGeneralLedgerEntriesSchema
>;

/**
 * Schema for updating a general ledger entries
 */
export const UpdateGeneralLedgerEntriesSchema =
	GeneralLedgerEntriesSchema.partial();

export type UpdateGeneralLedgerEntries = z.infer<
	typeof UpdateGeneralLedgerEntriesSchema
>;
