/**
 * Billing command schemas — Cashier domain
 * Covers cashier session open, close, and shift handover.
 * @category commands
 */

import { z } from "zod";

/**
 * Open a new cashier session (shift start).
 */
export const BillingCashierOpenCommandSchema = z.object({
	property_id: z.string().uuid(),
	cashier_id: z.string().uuid(),
	cashier_name: z.string().max(200),
	terminal_id: z.string().max(50).optional(),
	shift_type: z
		.enum(["morning", "afternoon", "evening", "night", "full_day", "custom"])
		.default("full_day"),
	opening_float: z.coerce.number().nonnegative().default(0),
	business_date: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingCashierOpenCommand = z.infer<
	typeof BillingCashierOpenCommandSchema
>;

/**
 * Close a cashier session (shift end) with reconciliation.
 */
export const BillingCashierCloseCommandSchema = z.object({
	session_id: z.string().uuid(),
	closing_cash_declared: z.coerce.number().nonnegative(),
	closing_cash_counted: z.coerce.number().nonnegative(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingCashierCloseCommand = z.infer<
	typeof BillingCashierCloseCommandSchema
>;

/**
 * Atomically close the current cashier session and open the next one,
 * recording cash count, open issues, and notes for the incoming shift.
 */
export const BillingCashierHandoverCommandSchema = z.object({
	/** Session being closed (outgoing cashier). */
	outgoing_session_id: z.string().uuid(),
	/** Cash declared by the outgoing cashier. */
	closing_cash_declared: z.coerce.number().nonnegative(),
	/** Cash physically counted during handover. */
	closing_cash_counted: z.coerce.number().nonnegative(),
	/** Notes from the outgoing shift about pending items, issues, etc. */
	handover_notes: z.string().max(4000).optional(),
	/** Incoming cashier details — used to open the next session. */
	incoming_cashier_id: z.string().uuid(),
	incoming_cashier_name: z.string().max(200),
	incoming_terminal_id: z.string().max(50).optional(),
	incoming_shift_type: z
		.enum(["morning", "afternoon", "evening", "night", "full_day", "custom"])
		.default("full_day"),
	/** Opening float for the incoming session (defaults to counted cash). */
	incoming_opening_float: z.coerce.number().nonnegative().optional(),
	property_id: z.string().uuid(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingCashierHandoverCommand = z.infer<
	typeof BillingCashierHandoverCommandSchema
>;
