/**
 * DEV DOC
 * Module: api/reservation-rows.ts
 * Purpose: Raw PostgreSQL row shapes for reservation lifecycle queries.
 *          These are the shapes `pg` returns, before any API-level mapping.
 * Ownership: Schema package
 */

// =====================================================
// LIFECYCLE REVERSALS (WS-04)
// =====================================================

/**
 * The reservation state a reversal needs to decide whether it may proceed and
 * what to put back.
 *
 * NUMERIC and TIMESTAMP columns arrive as strings or Dates depending on the
 * driver's type parsers; the handler narrows once at the boundary.
 */
export type ReservationReversalStateRow = {
	id: string;
	tenant_id: string;
	property_id: string | null;
	status: string;
	guest_id: string | null;
	room_type_id: string | null;
	room_number: string | null;
	check_in_date: Date | string;
	check_out_date: Date | string;
	actual_check_in: Date | string | null;
	actual_check_out: Date | string | null;
	cancellation_date: Date | string | null;
	cancellation_fee: string | number | null;
	total_amount: string | number | null;
	currency: string | null;
};

/**
 * A folio as a reversal sees it — enough to reopen it and to put the balance
 * back exactly where it was.
 */
export type ReservationReversalFolioRow = {
	folio_id: string;
	folio_number: string;
	folio_status: string;
	balance: string | number;
	total_charges: string | number;
	total_payments: string | number;
	currency_code: string | null;
	settled_at: Date | string | null;
};

/**
 * One posting a reversal is considering voiding.
 *
 * `posted_by_reversible_operation` is decided by the caller from the charge
 * code, not by SQL — which postings a given reversal owns is a policy
 * question, and putting it in the query would hide it.
 */
export type ReservationReversalPostingRow = {
	posting_id: string;
	charge_code: string;
	charge_description: string;
	total_amount: string | number;
	tax_amount: string | number | null;
	posting_date: Date | string;
	is_voided: boolean | null;
};

/** A reason code resolved for a reversal. */
export type ReasonCodeRow = {
	reason_id: string;
	reason_code: string;
	reason_name: string;
	reason_category: string;
	requires_approval: boolean | null;
	has_financial_impact: boolean | null;
};
