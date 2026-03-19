/**
 * DEV DOC
 * Module: api/cashier-rows.ts
 * Purpose: Raw PostgreSQL row shapes for cashier-service query results.
 * Ownership: Schema package
 */

// =====================================================
// CASHIER SESSION ROW
// =====================================================

/** Raw row shape from cashier_sessions table query with joined property data. */
export type CashierSessionRow = {
	session_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	session_number: string;
	session_name: string | null;
	cashier_id: string;
	cashier_name: string | null;
	terminal_id: string | null;
	terminal_name: string | null;
	location: string | null;
	session_status: string;
	opened_at: string | Date;
	closed_at: string | Date | null;
	business_date: string | Date;
	shift_type: string | null;
	opening_float_declared: number | string;
	total_transactions: number | null;
	total_revenue: number | string | null;
	total_refunds: number | string | null;
	net_revenue: number | string | null;
	expected_cash_balance: number | string | null;
	closing_cash_counted: number | string | null;
	cash_variance: number | string | null;
	has_variance: boolean | null;
	reconciled: boolean | null;
	approved: boolean | null;
	created_at: string | Date | null;
};
