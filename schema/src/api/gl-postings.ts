/**
 * DEV DOC
 * Module: api/gl-postings.ts
 * Purpose: Cross-service General Ledger posting contract.
 *          Defines the input shape every billing command MUST use when
 *          producing paired (debit, credit) GL entries inside the same
 *          DB transaction as the underlying charge_posting / payments
 *          row insert.
 * Ownership: Schema package
 *
 * Why this lives in `schema/`:
 *   - The same shape is consumed by billing-service (write path) and
 *     revenue-service (USALI batch export read path) and analytics
 *     (revenue rollups). Defining it locally would fork the contract.
 *
 * Performance note (20K ops/sec):
 *   - Posting is two INSERTs per charge/payment, executed inside the
 *     same transaction as the source row — atomic, no cross-DB hop.
 *   - The daily GL batch is upserted once per (tenant, property, business_date)
 *     and cached at the service layer; first event of the day pays the upsert
 *     cost, subsequent events pay zero.
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

// ---------------------------------------------------------------------------
// GL account code — VARCHAR(50) per general_ledger_entries.gl_account_code
// ---------------------------------------------------------------------------

export const GlAccountCodeSchema = z
	.string()
	.min(1)
	.max(50)
	.regex(
		/^[A-Z0-9_-]+$/,
		"GL account code must be uppercase alphanumeric with optional - or _",
	);
export type GlAccountCode = z.infer<typeof GlAccountCodeSchema>;

// ---------------------------------------------------------------------------
// GL posting source — must match general_ledger_entries.source_table CHECK
// ---------------------------------------------------------------------------

export const GlPostingSourceEnum = z.enum([
	"charge_postings",
	"payments",
	"spa_appointments",
	"banquet_event_orders",
	"manual_adjustment",
	"other",
]);
export type GlPostingSource = z.infer<typeof GlPostingSourceEnum>;

// ---------------------------------------------------------------------------
// Input shape — one call produces a balanced (debit, credit) pair
// ---------------------------------------------------------------------------

/**
 * Input to `postGlPair()`. The helper inserts two rows into
 * `general_ledger_entries` — one debit, one credit — that always sum to zero.
 *
 * Money is carried as `number` here (not string) because the helper writes
 * directly to `NUMERIC(15,2)` via parameterised SQL with explicit `::numeric`
 * casts; the regex-validated string form is reserved for PSP integration.
 */
export const GlPostingPairInputSchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	folio_id: uuid.optional(),
	reservation_id: uuid.optional(),

	debit_account: GlAccountCodeSchema,
	credit_account: GlAccountCodeSchema,
	amount: z.number().positive().finite(),
	currency: z.string().length(3),

	posting_date: z.string(), // YYYY-MM-DD business date
	department_code: z.string().max(20).optional(),
	usali_category: z.string().max(100).optional(),
	description: z.string().max(255).optional(),

	source_table: GlPostingSourceEnum,
	source_id: uuid,
	reference_number: z.string().max(100).optional(),
	created_by: uuid.optional(),
});
export type GlPostingPairInput = z.infer<typeof GlPostingPairInputSchema>;

// ---------------------------------------------------------------------------
// Row types (raw pg result shapes) — matches general_ledger_entries SQL
// ---------------------------------------------------------------------------

export type GlEntryRow = {
	gl_entry_id: string;
	gl_batch_id: string;
	tenant_id: string;
	property_id: string;
	folio_id: string | null;
	reservation_id: string | null;
	department_code: string | null;
	posting_date: string;
	gl_account_code: string;
	cost_center: string | null;
	usali_category: string | null;
	description: string | null;
	debit_amount: string;
	credit_amount: string;
	currency: string;
	source_table: GlPostingSource | null;
	source_id: string | null;
	reference_number: string | null;
	status: "DRAFT" | "READY" | "POSTED" | "VOIDED";
	created_at: string;
};

export type GlBatchRow = {
	gl_batch_id: string;
	tenant_id: string;
	property_id: string;
	batch_number: string;
	batch_date: string;
	accounting_period: string;
	source_module: "PMS" | "SPA" | "POS" | "EVENTS" | "OTHER";
	currency: string;
	debit_total: string;
	credit_total: string;
	entry_count: number;
	batch_status: "OPEN" | "REVIEW" | "POSTED" | "ERROR";
};
