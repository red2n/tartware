/**
 * Billing command schemas — Event (sales & catering) domain
 *
 * UI item 6 of ui-gaps/13-sales-catering.md. Event billing is a command rather
 * than an HTTP route on core-service because it reaches across services: the
 * event lives in core-service's `event_bookings`, the folio and its postings in
 * billing-service. That is COV-18's discriminator exactly.
 *
 * @category commands
 */

import { z } from "zod";

/**
 * Open the event's own folio and link it back to the booking.
 *
 * Idempotent on the folio number (`EVT-<event number>`), mirroring
 * `billing.group.setup`: dispatching it twice adopts the folio that already
 * exists rather than opening a second one.
 *
 * The §2 decision in ui-gaps/13-sales-catering.md is what this implements —
 * event revenue lands on `event_bookings.folio_id`, which is a MASTER folio
 * carrying no reservation.
 */
export const BillingEventSetupCommandSchema = z.object({
	property_id: z.string().uuid(),
	event_id: z.string().uuid(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingEventSetupCommand = z.infer<
	typeof BillingEventSetupCommandSchema
>;

/**
 * Post the event's charges to its folio.
 *
 * The lines are derived from the booking's own money columns by
 * `deriveEventChargeQuote` — the payload carries no amounts, so the operator
 * cannot post a total the booking does not say. Opens the folio first when the
 * event has none, so a single dispatch takes an unbilled event all the way to a
 * folio balance.
 *
 * Posts once: `event_bookings.charges_posted_at` is the guard, and a second
 * dispatch is refused rather than doubling the balance. Later additions —
 * consumption over the estimate, an extra AV hire — are ordinary charges on the
 * folio through the billing screen.
 */
export const BillingEventPostChargesCommandSchema = z.object({
	property_id: z.string().uuid(),
	event_id: z.string().uuid(),
	/** Posting date for every line; defaults to now. */
	posted_at: z.coerce.date().optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingEventPostChargesCommand = z.infer<
	typeof BillingEventPostChargesCommandSchema
>;
