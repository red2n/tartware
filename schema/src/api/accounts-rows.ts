/**
 * DEV DOC
 * Module: api/accounts-rows.ts
 * Purpose: Raw PostgreSQL row shapes for accounts-service query results.
 * Ownership: Schema package
 */

// =====================================================
// INVOICE ROW
// =====================================================

/** Raw row shape from invoices table query with joined property/guest data. */
export type InvoiceRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	reservation_id: string;
	confirmation_number: string | null;
	guest_id: string;
	guest_name: string | null;
	invoice_number: string;
	invoice_type: string | null;
	invoice_date: string | Date;
	due_date: string | Date | null;
	subtotal: number | string;
	tax_amount: number | string | null;
	discount_amount: number | string | null;
	total_amount: number | string;
	paid_amount: number | string | null;
	balance_due: number | string | null;
	currency: string | null;
	status: string | null;
	sent_at: string | Date | null;
	pdf_url: string | null;
	created_at: string | Date;
	updated_at: string | Date | null;
	version: bigint | null;
};
