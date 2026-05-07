/**
 * Billing command schemas — Advance Deposit Ledger (ACCT-02)
 *
 * Deposits are LIABILITIES until check-in, not revenue (ASC 606 / GAAP).
 *
 * Lifecycle:
 *   billing.deposit.record        DR 1100 (Cash) / CR 2200 (Advance Deposit Liability)
 *   billing.deposit.transfer      DR 2200 (Liability released) / CR 1200 (Guest Ledger applied)
 *   billing.deposit.refund        DR 2200 (Liability reversed) / CR 1100 (Cash returned)
 *   billing.deposit.waive         Waive a deposit schedule entry without GL movement
 *
 * @category commands
 */

import { z } from "zod";

import { PaymentMethodEnum } from "../../shared/enums.js";

// ─── Record a deposit payment ─────────────────────────────────────────────────

/**
 * Record receipt of an advance deposit against a deposit schedule entry.
 *
 * GL treatment: DR Cash (1100) / CR Advance Deposit Liability (2200).
 * The `schedule_id` is required to track which instalment is being satisfied.
 * If the deposit has no schedule (ad-hoc), omit `schedule_id` and the handler
 * will create a synthetic ledger entry.
 */
export const BillingDepositRecordCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	property_id: z.string().uuid(),
	/** Deposit schedule row being satisfied. Required for scheduled deposits. */
	schedule_id: z.string().uuid().optional(),
	amount: z.coerce.number().positive(),
	currency: z.string().length(3).default("USD"),
	payment_method: PaymentMethodEnum,
	payment_reference: z.string().trim().min(1).max(150),
	/** ISO-8601 date the payment was physically received. Defaults to business date. */
	received_date: z.coerce.date().optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingDepositRecordCommand = z.infer<
	typeof BillingDepositRecordCommandSchema
>;

// ─── Transfer deposit liability to folio credit (check-in) ───────────────────

/**
 * Convert an advance deposit liability into a folio credit at check-in.
 *
 * GL treatment: DR Advance Deposit Liability (2200) / CR Guest Ledger (1200).
 * Fires automatically when the reservation transitions to CHECKED_IN via the
 * reservation event listener, or can be triggered manually.
 *
 * All deposit records for the reservation are transferred unless `deposit_ids`
 * is supplied, in which case only those specific deposits are transferred.
 */
export const BillingDepositTransferCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	property_id: z.string().uuid(),
	folio_id: z.string().uuid(),
	/** Specific deposit record IDs to transfer. Omit to transfer all RECEIVED deposits. */
	deposit_ids: z.array(z.string().uuid()).optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingDepositTransferCommand = z.infer<
	typeof BillingDepositTransferCommandSchema
>;

// ─── Refund a deposit ────────────────────────────────────────────────────────

/**
 * Refund an advance deposit back to the guest.
 *
 * GL treatment: DR Advance Deposit Liability (2200) / CR Cash (1100).
 * Triggered automatically on cancellation when the cancellation policy allows
 * a refund, or manually by front desk.
 *
 * `deposit_id` refers to the deposit ledger record (payments row with
 * transaction_type = ADVANCE_DEPOSIT). Partial refunds are supported via `amount`.
 */
export const BillingDepositRefundCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	property_id: z.string().uuid(),
	/** Specific deposit record (payment ID) to refund. Omit to refund all eligible deposits. */
	deposit_id: z.string().uuid().optional(),
	/** Amount to refund. Defaults to full outstanding deposit balance. */
	amount: z.coerce.number().positive().optional(),
	currency: z.string().length(3).default("USD"),
	reason: z.string().max(1000).optional(),
	refund_reference: z.string().trim().max(150).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingDepositRefundCommand = z.infer<
	typeof BillingDepositRefundCommandSchema
>;

// ─── Waive a deposit schedule entry ──────────────────────────────────────────

/**
 * Waive a pending deposit schedule entry — guest is excused from paying it.
 * No GL movement; schedule status becomes WAIVED and amount_remaining → 0.
 */
export const BillingDepositWaiveCommandSchema = z.object({
	reservation_id: z.string().uuid(),
	property_id: z.string().uuid(),
	schedule_id: z.string().uuid(),
	reason: z.string().max(1000).optional(),
	waived_by: z.string().uuid().optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingDepositWaiveCommand = z.infer<
	typeof BillingDepositWaiveCommandSchema
>;
